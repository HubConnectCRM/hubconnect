"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { createClient } from "@/lib/supabase/client";
import { listenForRingSignals } from "@/lib/calls/signaling";
import { declineCallInvite, getPendingCallInvites, joinCallRoom, timeoutCallInvite } from "@/app/(app)/calls/actions";
import { Avatar, Button, Card } from "@/components/ui";

export default function IncomingCallListener({ profile }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [invite, setInvite] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const shownRoomsRef = useRef(new Set());

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    function showInvite(nextInvite) {
      if (!active || !nextInvite?.roomId || shownRoomsRef.current.has(nextInvite.roomId)) return;
      shownRoomsRef.current.add(nextInvite.roomId);
      setSecondsLeft(30);
      setInvite(nextInvite);
      if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
        const notification = new Notification(t("calls.incomingFrom", { name: nextInvite.fromName }), {
          body: nextInvite.kind === "audio" ? t("calls.audioOnly") : t("calls.video"),
          icon: "/logo.png",
          tag: `hubconnect-call-${nextInvite.roomId}`,
          requireInteraction: true,
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
    }

    const unsubscribe = listenForRingSignals(supabase, profile.id, (payload) => {
      if (payload.type === "invite") {
        showInvite({ roomId: payload.room_id, fromName: payload.from_name, kind: payload.kind });
      }
    });

    async function pollPending() {
      const pending = await getPendingCallInvites().catch(() => []);
      if (!pending?.length) return;
      const first = pending[0];
      showInvite({
        roomId: first.room_id,
        fromName: first.caller?.full_name || first.caller?.email || "HubConnect",
        kind: first.room?.kind || "video",
      });
    }

    void pollPending();
    const pollTimer = setInterval(pollPending, 4_000);

    return () => {
      active = false;
      clearInterval(pollTimer);
      unsubscribe();
    };
  }, [profile.id, t]);

  useEffect(() => {
    if (!invite) return;
    const timer = setInterval(() => {
      setSecondsLeft((value) => {
        if (value > 1) return value - 1;
        clearInterval(timer);
        const roomId = invite.roomId;
        setInvite(null);
        void timeoutCallInvite(roomId).catch(() => {});
        return 0;
      });
    }, 1_000);
    return () => clearInterval(timer);
  }, [invite]);

  if (!invite) return null;

  async function accept() {
    const roomId = invite.roomId;
    setInvite(null);
    await joinCallRoom(roomId);
    router.push(`/calls/${roomId}`);
  }

  async function decline() {
    await declineCallInvite(invite.roomId);
    setInvite(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-md">
      <Card className="w-full max-w-sm border-[var(--brand)]/30 p-5 shadow-2xl shadow-black">
        <div className="flex items-center gap-3">
          <Avatar name={invite.fromName} size={14} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold">{invite.fromName}</p>
            <p className="text-sm text-[var(--muted)]">
              {invite.kind === "audio" ? t("calls.incomingAudio") : t("calls.incomingVideo")}
            </p>
          </div>
          <span className="text-xs tabular-nums text-[var(--muted)]">0:{String(secondsLeft).padStart(2, "0")}</span>
        </div>
        <div className="mt-5 flex gap-2">
          <Button className="flex-1" onClick={accept}>
            {t("calls.accept")}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={decline}>
            {t("calls.decline")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
