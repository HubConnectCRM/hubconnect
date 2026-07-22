"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { createClient } from "@/lib/supabase/client";
import { createCallEngine } from "@/lib/calls/webrtc";
import { getCallRoomParticipants, joinCallRoom, leaveCallRoom } from "@/app/(app)/calls/actions";
import { Button, Card } from "@/components/ui";

export default function CallRoomView({ profile, roomId, kind }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [remoteStreams, setRemoteStreams] = useState({});
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [status, setStatus] = useState("connecting");
  const [mediaError, setMediaError] = useState("");

  const localVideoRef = useRef(null);
  const engineRef = useRef(null);
  const channelRef = useRef(null);
  const localStreamRef = useRef(null);
  const joinedAtRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function start() {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind !== "audio" });
      } catch {
        if (!cancelled) setMediaError(t("calls.mediaError"));
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const participant = await joinCallRoom(roomId);
      joinedAtRef.current = participant.joined_at;

      function sendSignal(payload) {
        channelRef.current?.send({
          type: "broadcast",
          event: "signal",
          payload: { ...payload, from_id: profile.id, room_id: roomId, ts: new Date().toISOString() },
        });
      }

      const engine = createCallEngine({
        localStream: stream,
        sendSignal,
        onRemoteStream: (peerId, remoteStream) => {
          setRemoteStreams((prev) => ({ ...prev, [peerId]: { stream: remoteStream, name: prev[peerId]?.name || "" } }));
        },
        onRemoteStreamRemoved: (peerId) => {
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[peerId];
            return next;
          });
        },
      });
      engineRef.current = engine;

      // Membership is authoritative via REST (call_room_participants), not
      // Realtime Presence — this keeps the wire protocol identical (and
      // easy to hand-replicate) on the iOS side, which has no Presence
      // client, only plain broadcast. A peer is "elder" (and therefore the
      // one who offers) if its joined_at is earlier than the other's.
      function maybeOfferAsElder(peerId, name, otherJoinedAt) {
        if (peerId === profile.id) return;
        setRemoteStreams((prev) => ({
          ...prev,
          [peerId]: { stream: prev[peerId]?.stream || null, name: name || prev[peerId]?.name || "" },
        }));
        if (new Date(joinedAtRef.current) < new Date(otherJoinedAt)) {
          engine.offerTo(peerId);
        }
      }

      const channel = supabase.channel(`call:${roomId}`, { config: { broadcast: { self: false } } });
      channelRef.current = channel;

      channel.on("broadcast", { event: "signal" }, ({ payload }) => {
        if (payload.from_id === profile.id) return;
        if (payload.type === "join-announce") {
          maybeOfferAsElder(payload.from_id, payload.from_name, payload.joined_at);
          return;
        }
        if (payload.to_id && payload.to_id !== profile.id) return;
        if (payload.type === "offer") engine.handleOffer(payload.from_id, payload.sdp);
        else if (payload.type === "answer") engine.handleAnswer(payload.from_id, payload.sdp);
        else if (payload.type === "ice-candidate") engine.handleIceCandidate(payload.from_id, payload.candidate);
        else if (payload.type === "hangup") engine.removePeer(payload.from_id);
      });

      channel.subscribe(async (subStatus) => {
        if (subStatus !== "SUBSCRIBED" || cancelled) return;
        setStatus("in-call");
        // Snapshot who's already here (elders don't need to be offered — the
        // elder rule means they'll offer to us once they see our announce).
        const existing = await getCallRoomParticipants(roomId);
        existing.forEach((p) => {
          if (p.user_id === profile.id) return;
          setRemoteStreams((prev) => ({
            ...prev,
            [p.user_id]: { stream: prev[p.user_id]?.stream || null, name: p.profile?.full_name || p.profile?.email || "" },
          }));
        });
        sendSignal({ type: "join-announce", from_name: profile.full_name || profile.email, joined_at: joinedAtRef.current });
      });
    }

    start();

    return () => {
      cancelled = true;
      channelRef.current?.send({
        type: "broadcast",
        event: "signal",
        payload: { type: "hangup", from_id: profile.id, room_id: roomId, ts: new Date().toISOString() },
      });
      engineRef.current?.closeAll();
      if (channelRef.current) createClient().removeChannel(channelRef.current);
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      leaveCallRoom(roomId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, kind, profile.id]);

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => (track.enabled = muted));
    setMuted((m) => !m);
  }

  function toggleCamera() {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((track) => (track.enabled = cameraOff));
    setCameraOff((c) => !c);
  }

  function hangUp() {
    router.push("/calls");
  }

  if (mediaError) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="p-8 text-center">
          <p className="text-sm text-red-600">{mediaError}</p>
          <Button className="mt-4" variant="secondary" onClick={() => router.push("/calls")}>
            {t("common.back")}
          </Button>
        </Card>
      </div>
    );
  }

  const remoteEntries = Object.entries(remoteStreams);

  return (
    <div className="mx-auto max-w-5xl">
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{t("calls.inCall")}</h1>
          <span className="text-sm text-[var(--muted)]">
            {status === "connecting" ? t("calls.connecting") : t("calls.participants", { count: remoteEntries.length + 1 })}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl bg-black">
            <video ref={localVideoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
            <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
              {t("calls.you")}
            </span>
          </div>
          {remoteEntries.map(([peerId, { stream, name }]) => (
            <RemoteTile key={peerId} stream={stream} name={name} />
          ))}
        </div>
        <div className="mt-5 flex justify-center gap-3">
          <Button variant="secondary" onClick={toggleMute}>
            {muted ? t("calls.unmute") : t("calls.mute")}
          </Button>
          {kind !== "audio" && (
            <Button variant="secondary" onClick={toggleCamera}>
              {cameraOff ? t("calls.cameraOn") : t("calls.cameraOff")}
            </Button>
          )}
          <Button variant="danger" onClick={hangUp}>
            {t("calls.hangUp")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function RemoteTile({ stream, name }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-black">
      <video ref={ref} autoPlay playsInline className="aspect-video w-full object-cover" />
      <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">{name}</span>
    </div>
  );
}
