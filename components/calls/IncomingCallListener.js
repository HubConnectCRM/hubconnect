"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { createClient } from "@/lib/supabase/client";
import { listenForRingSignals } from "@/lib/calls/signaling";
import { declineCallInvite, getPendingCallInvites, joinCallRoom } from "@/app/(app)/calls/actions";
import { Avatar, Button, Card } from "@/components/ui";

export default function IncomingCallListener({ profile }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [invite, setInvite] = useState(null);

  useEffect(() => {
    const supabase = createClient();
    const unsubscribe = listenForRingSignals(supabase, profile.id, (payload) => {
      if (payload.type === "invite") {
        setInvite({ roomId: payload.room_id, fromName: payload.from_name, kind: payload.kind });
      }
    });

    // Fallback for invites that arrived before this listener mounted.
    getPendingCallInvites().then((pending) => {
      if (!pending?.length) return;
      const first = pending[0];
      setInvite((current) =>
        current || {
          roomId: first.room_id,
          fromName: first.caller?.full_name || first.caller?.email || "",
          kind: first.room?.kind || "video",
        }
      );
    });

    return unsubscribe;
  }, [profile.id]);

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
    <div className="fixed bottom-6 right-6 z-50 w-80">
      <Card className="p-4 shadow-2xl">
        <div className="flex items-center gap-3">
          <Avatar name={invite.fromName} size={10} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{invite.fromName}</p>
            <p className="text-xs text-[var(--muted)]">{t("calls.incomingCall")}</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
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
