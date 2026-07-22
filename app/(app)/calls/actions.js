"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

function clean(value) {
  const result = (value ?? "").toString().trim();
  return result || null;
}

// Server Actions can't import lib/calls/signaling.js (a "use client" module
// built around the browser Supabase client) — this is the same broadcast,
// just sent from the server client requireProfile() already gives us. Must
// match the payload shape the iOS app's ring listener expects exactly
// (type/room_id/from_id/from_name/kind), since this is the only thing that
// tells a callee's already-open app "someone is calling" in real time — the
// call_invites row alone only gets picked up on next poll/foreground.
async function sendRingSignal(supabase, calleeId, payload) {
  const channel = supabase.channel(`ring:${calleeId}`, { config: { broadcast: { self: false } } });
  await new Promise((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
    });
  });
  await channel.send({ type: "broadcast", event: "signal", payload });
  await supabase.removeChannel(channel);
}

export async function createCallRoom(participantIds, kind = "video") {
  const { supabase, user, profile } = await requireProfile();

  const { data: room, error } = await supabase
    .from("call_rooms")
    .insert({ created_by: user.id, kind })
    .select()
    .single();
  if (error || !room) throw new Error(error?.message || "call_room_create_failed");

  await supabase.from("call_room_participants").insert({ room_id: room.id, user_id: user.id });

  const calleeIds = participantIds.filter((id) => id !== user.id);
  const invites = calleeIds.map((calleeId) => ({ room_id: room.id, caller_id: user.id, callee_id: calleeId }));
  if (invites.length) await supabase.from("call_invites").insert(invites);

  for (const calleeId of calleeIds) {
    await sendRingSignal(supabase, calleeId, {
      type: "invite",
      room_id: room.id,
      from_id: user.id,
      from_name: profile?.full_name || user.email,
      kind,
    });
  }

  return room;
}

export async function joinCallRoom(roomId) {
  const { supabase, user } = await requireProfile();

  const { data: inserted, error } = await supabase
    .from("call_room_participants")
    .insert({ room_id: roomId, user_id: user.id })
    .select()
    .single();

  let row = inserted;
  if (error) {
    const { data: existing } = await supabase
      .from("call_room_participants")
      .select()
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .single();
    row = existing;
  }

  await supabase
    .from("call_invites")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("callee_id", user.id);

  return row;
}

export async function declineCallInvite(roomId) {
  const { supabase, user } = await requireProfile();
  await supabase
    .from("call_invites")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("callee_id", user.id);
  return { ok: true };
}

export async function leaveCallRoom(roomId) {
  const { supabase, user } = await requireProfile();
  await supabase
    .from("call_room_participants")
    .update({ left_at: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq("user_id", user.id);
  return { ok: true };
}

export async function getCallRoomParticipants(roomId) {
  const { supabase } = await requireProfile();
  const { data } = await supabase
    .from("call_room_participants")
    .select("user_id, joined_at, profile:profiles(full_name, email)")
    .eq("room_id", roomId)
    .is("left_at", null)
    .order("joined_at", { ascending: true });
  return data || [];
}

export async function getPendingCallInvites() {
  const { supabase, user } = await requireProfile();
  const since = new Date(Date.now() - 30_000).toISOString();
  const { data } = await supabase
    .from("call_invites")
    .select("room_id, status, created_at, caller:profiles!call_invites_caller_id_fkey(full_name, email), room:call_rooms(kind)")
    .eq("callee_id", user.id)
    .eq("status", "ringing")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  return data || [];
}

function normalizeTranscript(value) {
  return (value ?? "").toString().replace(/\s+/g, " ").trim().slice(0, 100_000);
}

function responseText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text.trim();
  return (payload?.output || [])
    .flatMap((item) => item?.content || [])
    .map((item) => (item?.type === "output_text" ? item.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

async function generateCallSummary(transcript) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !transcript) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CALL_SUMMARY_MODEL || "gpt-5-nano",
        instructions:
          "Bir iş görüşmesi transkriptini Türkçe olarak 2-3 kısa cümlede özetle. Yalnızca transkriptte bulunan gerçekleri, kararları ve sonraki adımları yaz; bilgi uydurma.",
        input: transcript,
        max_output_tokens: 180,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    return responseText(await response.json()) || null;
  } catch {
    return null;
  }
}

export async function saveCallNote(roomId, rawNote) {
  const { supabase, profile } = await requireProfile();
  const note = normalizeTranscript(rawNote);
  if (!roomId || !note) return { error: "note_required" };

  const { data: membership, error: membershipError } = await supabase
    .from("call_room_participants")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (membershipError || !membership) return { error: "call_access_denied" };

  const { data: participants } = await supabase
    .from("call_room_participants")
    .select("user_id, profile:profiles(full_name, email)")
    .eq("room_id", roomId)
    .neq("user_id", profile.id)
    .order("joined_at", { ascending: true });

  const withNames = [...new Set(
    (participants || [])
      .map((participant) => participant.profile?.full_name || participant.profile?.email)
      .filter(Boolean)
  )].join(", ");

  const { data, error } = await supabase
    .from("call_notes")
    .insert({ room_id: roomId, user_id: profile.id, note, with_names: withNames })
    .select("id, room_id, note, summary, with_names, created_at")
    .single();
  if (error || !data) return { error: error?.message || "call_note_save_failed" };

  revalidatePath("/calls/notes");
  return { ok: true, note: data };
}

export async function updateCallNote(noteId, rawNote) {
  const { supabase, profile } = await requireProfile();
  const note = normalizeTranscript(rawNote);
  if (!noteId || !note) return { error: "note_required" };

  const { data, error } = await supabase
    .from("call_notes")
    .update({ note, summary: null })
    .eq("id", noteId)
    .eq("user_id", profile.id)
    .select("id, room_id, note, summary, with_names, created_at")
    .maybeSingle();
  if (error || !data) return { error: error?.message || "call_note_update_failed" };

  revalidatePath("/calls/notes");
  return { ok: true, note: data };
}

export async function summarizeCallNote(noteId) {
  const { supabase, profile } = await requireProfile();
  if (!process.env.OPENAI_API_KEY || !noteId) return { ok: true, skipped: true };

  const { data: callNote } = await supabase
    .from("call_notes")
    .select("id, note")
    .eq("id", noteId)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!callNote?.note) return { ok: true, skipped: true };

  const summary = await generateCallSummary(callNote.note);
  if (!summary) return { ok: true, skipped: true };

  const { error } = await supabase
    .from("call_notes")
    .update({ summary })
    .eq("id", noteId)
    .eq("user_id", profile.id);
  if (!error) revalidatePath("/calls/notes");
  return { ok: true, skipped: Boolean(error) };
}

export async function saveCallOutcome(prevState, formData) {
  const { supabase, user } = await requireProfile();
  const contactId = clean(formData.get("contact_id"));
  const outcome = clean(formData.get("outcome")) || "answered";
  const interactionType = clean(formData.get("interaction_type")) || "Telefon";
  const note = clean(formData.get("note")) || "";
  const relation = clean(formData.get("relation"));

  if (!contactId) return { error: "contact_required" };
  if (!["answered", "no_answer"].includes(outcome)) return { error: "invalid_outcome" };

  const { error: logError } = await supabase.from("call_logs").insert({
    contact_id: contactId,
    logged_by: user.id,
    user_id: user.id,
    interaction_type: interactionType,
    outcome,
    note,
  });
  if (logError) return { error: logError.message };

  if (outcome === "answered" && relation?.startsWith("event:")) {
    const registrationId = relation.slice("event:".length);
    await supabase
      .from("event_registrations")
      .update({
        rsvp: clean(formData.get("rsvp")) || "pending",
        last_contacted_at: new Date().toISOString(),
        last_contacted_note: `[${interactionType}] ${note}`.trim(),
      })
      .eq("id", registrationId);
  }

  if (outcome === "answered" && relation?.startsWith("lead:")) {
    const leadContactId = relation.slice("lead:".length);
    await supabase
      .from("lead_contacts")
      .update({
        status: clean(formData.get("lead_status")) || "meeting",
        probability: (clean(formData.get("probability")) || "t70").toLowerCase(),
        reconnect_at: clean(formData.get("reconnect_at")),
        next_step: clean(formData.get("next_step")),
        notes: note,
      })
      .eq("id", leadContactId);
  }

  await supabase.from("interactions").insert({
    contact_id: contactId,
    user_id: user.id,
    type: "call",
    topic: interactionType,
    action_text: outcome,
    next_step: note || null,
    occurred_on: new Date().toISOString().slice(0, 10),
  });

  revalidatePath("/calls");
  revalidatePath("/contact-center");
  revalidatePath(`/contacts/${contactId}`);
  return { ok: Date.now() };
}
