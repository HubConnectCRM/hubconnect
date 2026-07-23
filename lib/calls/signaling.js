"use client";

// Thin helpers around Supabase Realtime broadcast for the call-invite
// "ring" channel — one topic per user, subscribed for the whole session.
// Room-channel (offer/answer/ICE) signaling lives directly in CallRoomView.
// Membership discovery uses REST plus broadcast so the protocol remains
// identical to the minimal iOS Realtime client; Supabase Presence is not used.

export function ringTopic(userId) {
  return `ring:${userId}`;
}

export function roomTopic(roomId) {
  return `call:${roomId}`;
}

export async function sendRingSignal(supabase, calleeId, payload) {
  const channel = supabase.channel(ringTopic(calleeId), { config: { broadcast: { self: false } } });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("ring_channel_timeout")), 5_000);
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        }
        if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          clearTimeout(timeout);
          reject(new Error("ring_channel_unavailable"));
        }
      });
    });
    await channel.send({ type: "broadcast", event: "signal", payload });
    return true;
  } catch {
    // call_invites is the source of truth. A database poll and the iOS
    // call-notify webhook still deliver the call if this best-effort socket
    // broadcast happens while either side is reconnecting.
    return false;
  } finally {
    await supabase.removeChannel(channel);
  }
}

export function listenForRingSignals(supabase, userId, onSignal) {
  const channel = supabase
    .channel(ringTopic(userId), { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "signal" }, ({ payload }) => onSignal(payload))
    .subscribe();
  return () => supabase.removeChannel(channel);
}
