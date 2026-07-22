"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";

const localeByLanguage = { en: "en-GB", it: "it-IT", tr: "tr-TR" };

export default function CallNotesView({ notes, loadError }) {
  const { t, i18n } = useTranslation();
  const locale = localeByLanguage[i18n.language] || "tr-TR";
  const groups = useMemo(() => {
    const grouped = new Map();
    for (const note of notes) {
      if (!grouped.has(note.room_id)) grouped.set(note.room_id, []);
      grouped.get(note.room_id).push(note);
    }
    return Array.from(grouped, ([roomId, roomNotes]) => ({ roomId, notes: roomNotes }));
  }, [notes]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("calls.notesTitle")} subtitle={t("calls.notesSubtitle")}>
        <Button href="/calls" variant="secondary">{t("calls.backToCalls")}</Button>
      </PageHeader>

      {loadError && <Card className="mb-4 border-red-400/30 p-4 text-sm text-red-300">{loadError}</Card>}
      {groups.length === 0 ? (
        <EmptyState>{t("calls.noNotes")}</EmptyState>
      ) : (
        <div className="space-y-5">
          {groups.map(({ roomId, notes: roomNotes }) => {
            const first = roomNotes[0];
            const people = [...new Set(
              roomNotes
                .flatMap((note) => [note.author?.full_name || note.author?.email, ...(note.with_names || "").split(",")])
                .map((name) => name?.trim())
                .filter(Boolean)
            )];
            const callDate = first.room?.created_at || first.created_at;
            return (
              <Card key={roomId} className="overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{people.join(", ") || t("calls.unknownParticipants")}</h2>
                      <Badge color={first.room?.kind === "audio" ? "blue" : "brand"}>
                        {first.room?.kind === "audio" ? t("calls.audioOnly") : t("calls.video")}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {new Date(callDate).toLocaleString(locale)} · {t("calls.noteCount", { count: roomNotes.length })}
                    </p>
                  </div>
                  <span className="rounded-full bg-white/[0.05] px-3 py-1 text-xs text-zinc-500">
                    {roomId.slice(0, 8)}
                  </span>
                </div>
                <div className="grid gap-4 p-5 lg:grid-cols-2">
                  {roomNotes.map((note) => {
                    const author = note.author?.full_name || note.author?.email || t("calls.unknownAuthor");
                    return (
                      <article key={note.id} className="rounded-2xl border border-[var(--border)] bg-white/[0.025] p-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={author} size={8} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{author}</p>
                            <p className="text-xs text-[var(--muted)]">{new Date(note.created_at).toLocaleString(locale)}</p>
                          </div>
                        </div>
                        {note.summary && (
                          <div className="mt-4 rounded-2xl border border-[var(--brand)]/20 bg-[var(--brand)]/5 p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">{t("calls.aiSummary")}</p>
                            <p className="mt-1 text-sm leading-6 text-zinc-200">{note.summary}</p>
                          </div>
                        )}
                        <div className="mt-4">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{t("calls.transcript")}</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{note.note}</p>
                        </div>
                        {note.with_names && (
                          <p className="mt-4 border-t border-white/[0.06] pt-3 text-xs text-[var(--muted)]">
                            {t("calls.withNames", { names: note.with_names })}
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
