"use server";

import { requireProfile } from "@/lib/auth";

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
