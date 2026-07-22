"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

function clean(value) {
  const result = (value ?? "").toString().trim();
  return result || null;
}

export async function createCallRoom(participantIds, kind = "video") {
  const { supabase, user } = await requireProfile();

  const { data: room, error } = await supabase
    .from("call_rooms")
    .insert({ created_by: user.id, kind })
    .select()
    .single();
  if (error || !room) throw new Error(error?.message || "call_room_create_failed");

  await supabase.from("call_room_participants").insert({ room_id: room.id, user_id: user.id });

  const invites = participantIds
    .filter((id) => id !== user.id)
    .map((calleeId) => ({ room_id: room.id, caller_id: user.id, callee_id: calleeId }));
  if (invites.length) await supabase.from("call_invites").insert(invites);

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
