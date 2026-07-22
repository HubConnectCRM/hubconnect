"use client";

// Thin helpers around Supabase Realtime broadcast for the call-invite
// "ring" channel — one topic per user, subscribed for the whole session.
// Room-channel (offer/answer/ICE) signaling lives directly in CallRoomView
// since it also needs Presence, which this ring channel does not.

export function ringTopic(userId) {
  return `ring:${userId}`;
}

export function roomTopic(roomId) {
  return `call:${roomId}`;
}

export async function sendRingSignal(supabase, calleeId, payload) {
  const channel = supabase.channel(ringTopic(calleeId), { config: { broadcast: { self: false } } });
  await new Promise((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") resolve();
    });
  });
  await channel.send({ type: "broadcast", event: "signal", payload });
  supabase.removeChannel(channel);
}

export function listenForRingSignals(supabase, userId, onSignal) {
  const channel = supabase
    .channel(ringTopic(userId), { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "signal" }, ({ payload }) => onSignal(payload))
    .subscribe();
  return () => supabase.removeChannel(channel);
}
