"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { createClient } from "@/lib/supabase/client";
import { createCallEngine } from "@/lib/calls/webrtc";
import {
  getCallRoomParticipants,
  joinCallRoom,
  leaveCallRoom,
  saveCallNote,
  summarizeCallNote,
  updateCallNote,
} from "@/app/(app)/calls/actions";
import { Button, Card, Textarea } from "@/components/ui";

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

// This IS the classic North American telephone ringback cadence (440/480Hz,
// 2s on / 4s off) — unlike the callee-side chime in IncomingCallListener.js,
// this plays for the CALLER while waiting for the other side to answer, so
// the "someone is dialing" association is the correct one here.
function startRingbackTone() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return () => {};
  const ctx = new AudioContextClass();
  let stopped = false;
  let cycleTimer = null;

  function ring() {
    if (stopped) return;
    const now = ctx.currentTime;
    for (const freq of [440, 480]) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.05);
      gain.gain.setValueAtTime(0.15, now + 1.95);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + 2);
    }
    cycleTimer = setTimeout(ring, 6_000);
  }

  function tryResume() {
    void ctx.resume().then(() => {
      if (ctx.state === "running") {
        document.removeEventListener("pointerdown", tryResume);
        document.removeEventListener("keydown", tryResume);
      }
    }).catch(() => {});
  }
  tryResume();
  document.addEventListener("pointerdown", tryResume);
  document.addEventListener("keydown", tryResume);
  ring();

  return () => {
    stopped = true;
    if (cycleTimer) clearTimeout(cycleTimer);
    document.removeEventListener("pointerdown", tryResume);
    document.removeEventListener("keydown", tryResume);
    void ctx.close().catch(() => {});
  };
}

export default function CallRoomView({ profile, roomId, kind }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [remoteStreams, setRemoteStreams] = useState({});
  const [peerStates, setPeerStates] = useState({});
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [status, setStatus] = useState("connecting");
  const [callStartedAt, setCallStartedAt] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [outputDevices, setOutputDevices] = useState([]);
  const [sinkId, setSinkId] = useState("default");
  const [mediaError, setMediaError] = useState("");
  const [transcriptPreview, setTranscriptPreview] = useState("");
  const [review, setReview] = useState(null);
  const [reviewDraft, setReviewDraft] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);

  const localVideoRef = useRef(null);
  const engineRef = useRef(null);
  const channelRef = useRef(null);
  const localStreamRef = useRef(null);
  const joinedAtRef = useRef(null);
  const recognitionRef = useRef(null);
  const recognitionRestartRef = useRef(false);
  const transcriptRef = useRef("");
  const interimTranscriptRef = useRef("");
  const teardownRef = useRef(null);
  const savePromiseRef = useRef(null);
  const knownParticipantsRef = useRef(new Set());

  useEffect(() => {
    if (!callStartedAt) return;
    const update = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - callStartedAt) / 1_000)));
    update();
    const timer = setInterval(update, 1_000);
    return () => clearInterval(timer);
  }, [callStartedAt]);

  useEffect(() => {
    if (status !== "ringing") return;
    const stop = startRingbackTone();
    return stop;
  }, [status]);

  async function persistTranscript() {
    const note = `${transcriptRef.current} ${interimTranscriptRef.current}`.replace(/\s+/g, " ").trim();
    if (!note) return null;
    if (savePromiseRef.current) return savePromiseRef.current;

    const promise = saveCallNote(roomId, note)
      .then((result) => {
        if (result?.error || !result?.note) throw new Error(result?.error || "call_note_save_failed");
        void summarizeCallNote(result.note.id).catch(() => {});
        return result.note;
      })
      .catch((error) => {
        savePromiseRef.current = null;
        throw error;
      });
    savePromiseRef.current = promise;
    return promise;
  }

  useEffect(() => {
    let cancelled = false;
    let recognitionRestartTimer = null;
    let teardownPromise = null;
    const negotiationTimers = [];
    const supabase = createClient();

    function startSpeechRecognition() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition || cancelled) return;
      setSpeechSupported(true);

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "tr-TR";
      recognitionRestartRef.current = true;
      recognitionRef.current = recognition;

      recognition.onresult = (event) => {
        let finalText = "";
        let interimText = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const part = event.results[index]?.[0]?.transcript?.trim();
          if (!part) continue;
          if (event.results[index].isFinal) finalText += `${part} `;
          else interimText += `${part} `;
        }
        if (finalText.trim()) {
          transcriptRef.current = `${transcriptRef.current} ${finalText}`.replace(/\s+/g, " ").trim();
        }
        interimTranscriptRef.current = interimText.trim();
        if (!cancelled) {
          setTranscriptPreview(`${transcriptRef.current} ${interimText}`.replace(/\s+/g, " ").trim());
        }
      };

      recognition.onerror = (event) => {
        if (["not-allowed", "service-not-allowed", "audio-capture"].includes(event.error)) {
          recognitionRestartRef.current = false;
        }
      };
      recognition.onend = () => {
        if (!recognitionRestartRef.current || cancelled) return;
        recognitionRestartTimer = setTimeout(() => {
          try {
            recognition.start();
          } catch {}
        }, 250);
      };

      try {
        recognition.start();
      } catch {
        recognitionRestartRef.current = false;
      }
    }

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
      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!cancelled) setOutputDevices(devices.filter((device) => device.kind === "audiooutput"));
      }
      const initialParticipants = await getCallRoomParticipants(roomId).catch(() => []);
      let participant = initialParticipants.find((row) => row.user_id === profile.id);
      // CallPicker inserts the caller before navigation and the incoming-call
      // accept flow inserts the callee before opening this page. Avoid a
      // second mutating Server Action here: Next can reconcile/remount the
      // route after that action, and the old effect cleanup used to publish a
      // false hangup. Keep join as a deep-link recovery only.
      if (!participant) participant = await joinCallRoom(roomId);
      if (cancelled || !participant?.joined_at) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
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
        onConnectionState: (peerId, connectionState) => {
          setPeerStates((prev) => ({ ...prev, [peerId]: connectionState }));
          if (connectionState === "connected") {
            setCallStartedAt((current) => current || Date.now());
            setStatus("in-call");
            if (!recognitionRef.current) startSpeechRecognition();
          } else if (["failed", "closed"].includes(connectionState)) {
            setStatus((current) => current === "ending" ? current : "connecting");
          }
        },
      });
      engineRef.current = engine;

      // Which side offers used to be decided by comparing server-assigned
      // "joined_at" timestamps — but confirmed via real device logs, that
      // comparison isn't always consistent between the two clients (network
      // round-trip timing, clock skew), and both sides occasionally decided
      // they were the elder at once. A pure string comparison of the two
      // participants' own user IDs is deterministic and instant — no
      // network round trip, no clock involved — and by definition can never
      // agree for both sides at once.
      function isElder(otherId) {
        return profile.id < otherId;
      }

      function maybeOfferAsElder(peerId, name) {
        if (peerId === profile.id) return;
        knownParticipantsRef.current.add(peerId);
        setRemoteStreams((prev) => ({
          ...prev,
          [peerId]: { stream: prev[peerId]?.stream || null, name: name || prev[peerId]?.name || "" },
        }));
        if (isElder(peerId)) engine.offerTo(peerId);
      }

      const channel = supabase.channel(`call:${roomId}`, { config: { broadcast: { self: false } } });
      channelRef.current = channel;

      channel.on("broadcast", { event: "signal" }, ({ payload }) => {
        const senderId = payload.from_id;
        if (!senderId || senderId === profile.id) return;
        if (payload.type === "join-announce") {
          maybeOfferAsElder(senderId, payload.from_name);
          return;
        }
        if (payload.to_id && payload.to_id !== profile.id) return;
        if (payload.type === "offer") void engine.handleOffer(senderId, payload.sdp).catch(() => {});
        else if (payload.type === "answer") void engine.handleAnswer(senderId, payload.sdp).catch(() => {});
        else if (payload.type === "ice-candidate") void engine.handleIceCandidate(senderId, payload.candidate).catch(() => {});
        else if (payload.type === "hangup") {
          engine.removePeer(senderId);
          knownParticipantsRef.current.delete(senderId);
          // A 1-on-1 call's only other participant just left — the call is
          // over, not "waiting to reconnect". A group call (someone else
          // still on the line) should keep going.
          if (knownParticipantsRef.current.size === 0) void hangUp();
        }
      });

      channel.subscribe(async (subStatus) => {
        if (subStatus !== "SUBSCRIBED" || cancelled) return;
        setStatus("ringing");
        const existing = await getCallRoomParticipants(roomId);
        existing.forEach((participantRow) => {
          if (participantRow.user_id === profile.id) return;
          setRemoteStreams((prev) => ({
            ...prev,
            [participantRow.user_id]: {
              stream: prev[participantRow.user_id]?.stream || null,
              name: participantRow.profile?.full_name || participantRow.profile?.email || "",
            },
          }));
          maybeOfferAsElder(
            participantRow.user_id,
            participantRow.profile?.full_name || participantRow.profile?.email || ""
          );
        });
        const announce = () => {
          if (!cancelled) {
            sendSignal({
              type: "join-announce",
              from_name: profile.full_name || profile.email,
              joined_at: joinedAtRef.current,
            });
          }
        };
        announce();
        negotiationTimers.push(setTimeout(announce, 700));
        negotiationTimers.push(setTimeout(announce, 2_000));

        // Re-read durable membership as a fallback. Prefer the elder rule,
        // then let the browser offer only when no peer negotiation exists at
        // all. This recovers from a missed/malformed join announcement without
        // creating a second offer while ICE is already checking.
        for (const delay of [2_500, 5_000]) {
          negotiationTimers.push(setTimeout(async () => {
            if (cancelled) return;
            const participants = await getCallRoomParticipants(roomId).catch(() => []);
            for (const participantRow of participants) {
              if (participantRow.user_id === profile.id || engine.isConnected(participantRow.user_id)) continue;
              maybeOfferAsElder(
                participantRow.user_id,
                participantRow.profile?.full_name || participantRow.profile?.email || ""
              );
            }
          }, delay));
        }
      });
    }

    teardownRef.current = ({ notifyPeer = false, leaveRoom = false } = {}) => {
      if (teardownPromise) return teardownPromise;
      teardownPromise = (async () => {
        recognitionRestartRef.current = false;
        if (recognitionRestartTimer) clearTimeout(recognitionRestartTimer);
        negotiationTimers.forEach(clearTimeout);
        try {
          recognitionRef.current?.stop();
        } catch {}
        if (notifyPeer) {
          await channelRef.current?.send({
            type: "broadcast",
            event: "signal",
            payload: { type: "hangup", from_id: profile.id, room_id: roomId, ts: new Date().toISOString() },
          });
        }
        engineRef.current?.closeAll();
        if (channelRef.current) await supabase.removeChannel(channelRef.current);
        localStreamRef.current?.getTracks().forEach((track) => track.stop());
        if (leaveRoom) await leaveCallRoom(roomId).catch(() => {});
      })();
      return teardownPromise;
    };

    start();

    return () => {
      cancelled = true;
      // React/Next may dispose and recreate this effect during route
      // reconciliation. Cleanup must only release local resources; publishing
      // hangup here makes a harmless remount terminate the other device.
      void teardownRef.current?.({ notifyPeer: false, leaveRoom: false });
      if (`${transcriptRef.current} ${interimTranscriptRef.current}`.trim()) {
        setTimeout(() => void persistTranscript().catch(() => {}), 300);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, kind, profile.id]);

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((track) => (track.enabled = muted));
    setMuted((value) => !value);
  }

  function toggleCamera() {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((track) => (track.enabled = cameraOff));
    setCameraOff((value) => !value);
  }

  function formatElapsed(seconds) {
    const minutes = Math.floor(seconds / 60);
    return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  async function hangUp() {
    if (status === "ending") return;
    setStatus("ending");
    await teardownRef.current?.({ notifyPeer: true, leaveRoom: true });
    await wait(300);

    const transcript = `${transcriptRef.current} ${interimTranscriptRef.current}`.replace(/\s+/g, " ").trim();
    if (!transcript) {
      setReview({ id: null, autoSaved: false });
      setReviewDraft("");
      return;
    }

    setReviewSaving(true);
    try {
      const saved = await persistTranscript();
      setReview({ id: saved.id, autoSaved: true, saved: true });
      setReviewDraft(saved.note);
    } catch {
      setReview({ id: null, autoSaved: false, attemptedAutoSave: true });
      setReviewDraft(transcript);
      setReviewError(t("calls.noteSaveError"));
    } finally {
      setReviewSaving(false);
    }
  }

  async function saveReview() {
    const draft = reviewDraft.replace(/\s+/g, " ").trim();
    if (!draft) {
      setReviewError(t("calls.noteRequired"));
      return;
    }
    setReviewSaving(true);
    setReviewError("");
    try {
      const result = review?.id ? await updateCallNote(review.id, draft) : await saveCallNote(roomId, draft);
      if (result?.error || !result?.note) throw new Error(result?.error || "call_note_save_failed");
      void summarizeCallNote(result.note.id).catch(() => {});
      setReview({ id: result.note.id, autoSaved: Boolean(review?.autoSaved), saved: true });
      setReviewDraft(result.note.note);
    } catch {
      setReviewError(t("calls.noteSaveError"));
    } finally {
      setReviewSaving(false);
    }
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
  const connectedEntries = remoteEntries.filter(([, participant]) => participant.stream);
  const remoteNames = remoteEntries.map(([, participant]) => participant.name).filter(Boolean);
  const callStatus = status === "connecting"
    ? t("calls.connecting")
    : status === "ringing"
      ? t("calls.ringing")
      : status === "ending"
        ? t("calls.ending")
        : formatElapsed(elapsedSeconds);

  return (
    <div className="mx-auto max-w-5xl">
      <Card className="overflow-hidden border-white/10 bg-gradient-to-b from-[#0d1c13] to-black p-0">
        <div className="relative flex min-h-[620px] flex-col p-5 md:p-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">{kind === "audio" ? t("calls.audioCall") : t("calls.videoCall")}</h1>
              <p className="mt-0.5 text-sm text-[var(--muted)]">
                {remoteNames.length ? remoteNames.join(", ") : t("calls.waitingForAnswer")}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm tabular-nums text-[var(--brand)]">{callStatus}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{t("calls.participants", { count: connectedEntries.length + 1 })}</p>
            </div>
          </div>

          {(speechSupported || transcriptPreview) && (
            <div className="mx-auto mt-5 flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--brand)]" />
              {t("calls.transcribing")}
            </div>
          )}

          {kind === "audio" ? (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
              <div className="flex h-36 w-36 items-center justify-center rounded-full border border-[var(--brand)]/30 bg-[var(--brand)] text-4xl font-bold text-[var(--brand-ink)] shadow-[0_0_80px_rgba(217,250,132,0.16)]">
                {initials(remoteNames[0] || profile.full_name || profile.email)}
              </div>
              <h2 className="mt-6 max-w-xl text-2xl font-semibold">
                {remoteNames.length ? remoteNames.join(", ") : t("calls.connecting")}
              </h2>
              <p className="mt-2 font-mono text-sm tabular-nums text-zinc-400">{callStatus}</p>
              {remoteEntries.map(([peerId, participant]) => (
                <RemoteMedia key={peerId} stream={participant.stream} name={participant.name} audioOnly sinkId={sinkId} />
              ))}
            </div>
          ) : (
            <div className="mt-5 grid flex-1 grid-cols-1 content-center gap-4 sm:grid-cols-2">
              {remoteEntries.map(([peerId, participant]) => (
                <RemoteMedia key={peerId} stream={participant.stream} name={participant.name} sinkId={sinkId} state={peerStates[peerId]} />
              ))}
              {remoteEntries.length === 0 && (
                <div className="col-span-full flex min-h-80 flex-col items-center justify-center rounded-3xl border border-white/10 bg-black/35">
                  <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-[var(--brand)]" />
                  <p className="mt-4 text-sm text-zinc-400">{t("calls.waitingForAnswer")}</p>
                </div>
              )}
              <div className="relative ml-auto w-full max-w-xs overflow-hidden rounded-3xl border border-white/15 bg-black shadow-2xl sm:col-start-2">
                <video ref={localVideoRef} autoPlay muted playsInline className="aspect-video w-full object-cover" />
                <span className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-1 text-xs text-white">{t("calls.you")}</span>
              </div>
            </div>
          )}

          {transcriptPreview && (
            <div className="mt-4 rounded-2xl border border-[var(--brand)]/20 bg-black/45 p-3 backdrop-blur">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">{t("calls.liveNote")}</p>
              <p className="mt-1 line-clamp-3 text-sm text-zinc-300">{transcriptPreview}</p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Button variant="secondary" className={muted ? "border-red-400/40 bg-red-500/20" : ""} onClick={toggleMute} disabled={status === "ending"}>
              {muted ? t("calls.unmute") : t("calls.mute")}
            </Button>
            {outputDevices.length > 1 && (
              <label className="sr-only" htmlFor="call-output">{t("calls.audioOutput")}</label>
            )}
            {outputDevices.length > 1 && (
              <select
                id="call-output"
                value={sinkId}
                onChange={(event) => setSinkId(event.target.value)}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2.5 text-sm font-semibold text-white outline-none focus:border-[var(--brand)]"
              >
                {outputDevices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || t("calls.audioOutputNumber", { number: index + 1 })}
                  </option>
                ))}
              </select>
            )}
            {kind !== "audio" && (
              <Button variant="secondary" className={cameraOff ? "border-red-400/40 bg-red-500/20" : ""} onClick={toggleCamera} disabled={status === "ending"}>
                {cameraOff ? t("calls.cameraOn") : t("calls.cameraOff")}
              </Button>
            )}
            <Button variant="danger" onClick={hangUp} disabled={status === "ending"}>
              {status === "ending" ? t("calls.savingNote") : t("calls.hangUp")}
            </Button>
          </div>
        </div>
      </Card>

      {review && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm">
          <Card className="w-full max-w-xl p-5">
            <h2 className="text-xl font-semibold">
              {review.saved ? t("calls.noteSavedTitle") : t("calls.addNoteTitle")}
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {review.autoSaved
                ? t("calls.noteSavedReview")
                : review.saved
                  ? t("calls.noteSavedManual")
                  : t("calls.addNoteHint")}
            </p>
            <Textarea
              className="mt-4 min-h-40"
              value={reviewDraft}
              onChange={(event) => setReviewDraft(event.target.value)}
              placeholder={t("calls.notePlaceholder")}
            />
            {reviewError && <p className="mt-2 text-sm text-red-400">{reviewError}</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => router.push("/calls")} disabled={reviewSaving}>
                {review.id ? t("common.close") : t("calls.skipNote")}
              </Button>
              <Button variant="secondary" onClick={() => router.push("/calls/notes")} disabled={!review.id || reviewSaving}>
                {t("calls.viewNotes")}
              </Button>
              <Button onClick={saveReview} disabled={reviewSaving || !reviewDraft.trim()}>
                {reviewSaving ? t("common.saving") : review.id ? t("calls.saveChanges") : t("common.save")}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function initials(name) {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function RemoteMedia({ stream, name, audioOnly = false, sinkId = "default", state }) {
  const { t } = useTranslation();
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream || null;
    if (typeof ref.current.setSinkId === "function") void ref.current.setSinkId(sinkId).catch(() => {});
    if (stream) void ref.current.play().catch(() => {});
  }, [stream, sinkId]);

  if (audioOnly) return <audio ref={ref} autoPlay playsInline />;
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black">
      {stream ? (
        <video ref={ref} autoPlay playsInline className="aspect-video w-full object-cover" />
      ) : (
        <div className="flex aspect-video flex-col items-center justify-center bg-white/[0.04]">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--brand)] text-xl font-bold text-[var(--brand-ink)]">
            {initials(name)}
          </div>
          <p className="mt-3 text-sm text-zinc-400">{state === "failed" ? t("calls.connectionFailed") : t("calls.connecting")}</p>
        </div>
      )}
      <span className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-1 text-xs text-white">{name}</span>
    </div>
  );
}
