"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { createClient } from "@/lib/supabase/client";
import { createCallRoom } from "@/app/(app)/calls/actions";
import { sendRingSignal } from "@/lib/calls/signaling";
import { Avatar, Button, Card, EmptyState, PageHeader } from "@/components/ui";

export default function CallPicker({ profile, teammates }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [selected, setSelected] = useState([]);
  const [kind, setKind] = useState("video");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function start() {
    if (selected.length === 0) return;
    setError("");
    startTransition(async () => {
      try {
        const room = await createCallRoom(selected, kind);
        const supabase = createClient();
        for (const calleeId of selected) {
          await sendRingSignal(supabase, calleeId, {
            type: "invite",
            room_id: room.id,
            from_id: profile.id,
            from_name: profile.full_name || profile.email,
            kind,
            ts: new Date().toISOString(),
          });
        }
        router.push(`/calls/${room.id}`);
      } catch (e) {
        setError(e?.message || "call_start_failed");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("calls.title")} subtitle={t("calls.subtitle")}>
        <Button href="/calls/notes" variant="secondary">{t("calls.viewNotes")}</Button>
      </PageHeader>
      <Card className="p-5">
        <div className="mb-4 flex gap-2">
          <Button variant={kind === "video" ? "primary" : "secondary"} onClick={() => setKind("video")}>
            {t("calls.video")}
          </Button>
          <Button variant={kind === "audio" ? "primary" : "secondary"} onClick={() => setKind("audio")}>
            {t("calls.audioOnly")}
          </Button>
        </div>
        {teammates.length === 0 ? (
          <EmptyState>{t("common.noResults")}</EmptyState>
        ) : (
          <div className="space-y-2">
            {teammates.map((tm) => (
              <label
                key={tm.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border)] p-3 hover:bg-[var(--background)]"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(tm.id)}
                  onChange={() => toggle(tm.id)}
                  className="h-4 w-4 rounded border-[var(--border)] text-[var(--brand)] focus:ring-[var(--brand)]"
                />
                <Avatar name={tm.full_name || tm.email} size={8} />
                <span className="text-sm font-medium">{tm.full_name || tm.email}</span>
              </label>
            ))}
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end">
          <Button onClick={start} disabled={pending || selected.length === 0}>
            {pending ? t("calls.starting") : t("calls.start")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
