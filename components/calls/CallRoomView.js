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

export default function CallRoomView({ profile, roomId, kind }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [remoteStreams, setRemoteStreams] = useState({});
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [status, setStatus] = useState("connecting");
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
    const supabase = createClient();

    function startSpeechRecognition() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition || cancelled) return;

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
      startSpeechRecognition();

      const participant = await joinCallRoom(roomId);
      if (cancelled || !participant?.joined_at) {
        stream.getTracks().forEach((track) => track.stop());
        await leaveCallRoom(roomId).catch(() => {});
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
      });
      engineRef.current = engine;

      function maybeOfferAsElder(peerId, name, otherJoinedAt) {
        if (peerId === profile.id) return;
        setRemoteStreams((prev) => ({
          ...prev,
          [peerId]: { stream: prev[peerId]?.stream || null, name: name || prev[peerId]?.name || "" },
        }));
        if (new Date(joinedAtRef.current) < new Date(otherJoinedAt)) engine.offerTo(peerId);
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
        });
        sendSignal({ type: "join-announce", from_name: profile.full_name || profile.email, joined_at: joinedAtRef.current });
      });
    }

    teardownRef.current = () => {
      if (teardownPromise) return teardownPromise;
      teardownPromise = (async () => {
        recognitionRestartRef.current = false;
        if (recognitionRestartTimer) clearTimeout(recognitionRestartTimer);
        try {
          recognitionRef.current?.stop();
        } catch {}
        channelRef.current?.send({
          type: "broadcast",
          event: "signal",
          payload: { type: "hangup", from_id: profile.id, room_id: roomId, ts: new Date().toISOString() },
        });
        engineRef.current?.closeAll();
        if (channelRef.current) await supabase.removeChannel(channelRef.current);
        localStreamRef.current?.getTracks().forEach((track) => track.stop());
        await leaveCallRoom(roomId).catch(() => {});
      })();
      return teardownPromise;
    };

    start();

    return () => {
      cancelled = true;
      void teardownRef.current?.();
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

  async function hangUp() {
    if (status === "ending") return;
    setStatus("ending");
    await teardownRef.current?.();
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

  return (
    <div className="mx-auto max-w-5xl">
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">{t("calls.inCall")}</h1>
          <span className="text-sm text-[var(--muted)]">
            {status === "connecting"
              ? t("calls.connecting")
              : status === "ending"
                ? t("calls.ending")
                : t("calls.participants", { count: remoteEntries.length + 1 })}
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
        {transcriptPreview && (
          <div className="mt-4 rounded-2xl border border-[var(--brand)]/20 bg-[var(--brand)]/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">{t("calls.liveNote")}</p>
            <p className="mt-1 line-clamp-3 text-sm text-zinc-300">{transcriptPreview}</p>
          </div>
        )}
        <div className="mt-5 flex justify-center gap-3">
          <Button variant="secondary" onClick={toggleMute} disabled={status === "ending"}>
            {muted ? t("calls.unmute") : t("calls.mute")}
          </Button>
          {kind !== "audio" && (
            <Button variant="secondary" onClick={toggleCamera} disabled={status === "ending"}>
              {cameraOff ? t("calls.cameraOn") : t("calls.cameraOff")}
            </Button>
          )}
          <Button variant="danger" onClick={hangUp} disabled={status === "ending"}>
            {status === "ending" ? t("calls.savingNote") : t("calls.hangUp")}
          </Button>
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
