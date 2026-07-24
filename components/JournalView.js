"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { addJournalTask, toggleJournalTask } from "@/app/(app)/journal/actions";

const KIND_COLOR = { call_note: "brand", task: "amber", lead_update: "blue" };

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function JournalView({ entries }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const needle = query.toLowerCase();
    return entries.filter((entry) => `${entry.title} ${entry.note}`.toLowerCase().includes(needle));
  }, [entries, query]);

  const grouped = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const byDay = new Map();
    for (const entry of filtered) {
      const created = new Date(entry.created_at);
      const dayKey = created.toDateString();
      if (!byDay.has(dayKey)) byDay.set(dayKey, { date: created, rows: [] });
      byDay.get(dayKey).rows.push(entry);
    }
    return Array.from(byDay.values())
      .sort((a, b) => b.date - a.date)
      .map((group) => ({
        ...group,
        heading: sameDay(group.date, today) ? t("journal.today") : sameDay(group.date, yesterday) ? t("journal.yesterday") : group.date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }),
      }));
  }, [filtered, t]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("journal.title")} subtitle={t("journal.subtitle")}>
        <Button type="button" onClick={() => setShowAdd(true)}>＋ {t("journal.addTask")}</Button>
      </PageHeader>

      <Card className="mb-5 p-4">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("journal.searchPlaceholder")} />
      </Card>

      {grouped.length === 0 ? (
        <Card className="p-10 text-center text-[var(--muted)]">
          <p className="font-semibold text-[var(--foreground)]">{t("journal.noEntries")}</p>
          <p className="mt-1 text-sm">{t("journal.noEntriesDescription")}</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.date.toISOString()}>
              <h3 className="mb-2 text-sm font-semibold capitalize text-[var(--muted)]">{group.heading}</h3>
              <div className="space-y-2">
                {group.rows.map((entry) => (
                  <JournalRow key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {showAdd && <AddTaskModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function JournalRow({ entry }) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(entry.completed);

  return (
    <Card className={`flex items-start gap-3 p-4 ${completed ? "opacity-60" : ""}`}>
      <Badge color={KIND_COLOR[entry.kind] || "gray"}>{t(`journal.kinds.${entry.kind}`)}</Badge>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className={`truncate font-semibold ${completed ? "line-through" : ""}`}>{entry.title}</p>
          <span className="shrink-0 text-xs text-[var(--muted)]">{new Date(entry.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
        {entry.note && <p className="mt-1 text-sm text-[var(--muted)]">{entry.note}</p>}
        {entry.kind === "task" && entry.due_at && (
          <p className="mt-1 text-xs text-[var(--brand)]">{new Date(entry.due_at).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
        )}
      </div>
      {entry.kind === "task" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const next = !completed;
              setCompleted(next);
              await toggleJournalTask(entry.id, next);
            })
          }
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs ${completed ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]" : "border-[var(--border)] text-transparent"}`}
        >
          ✓
        </button>
      )}
    </Card>
  );
}

function AddTaskModal({ onClose }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [state, action, pending] = useActionState(addJournalTask, {});
  const [hasDueDate, setHasDueDate] = useState(true);
  const defaultDue = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const localValue = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onClose();
    }
  }, [state?.ok, router, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <Card className="w-full max-w-lg p-5" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">{t("journal.newTask")}</h2>
          <Button type="button" variant="secondary" onClick={onClose}>{t("common.close")}</Button>
        </div>
        <form action={action} className="space-y-4">
          <Field label={t("journal.taskTitle")} required>
            <Input name="title" required />
          </Field>
          <Field label={t("journal.taskNote")}>
            <Textarea name="note" rows={3} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={hasDueDate} onChange={(event) => setHasDueDate(event.target.checked)} className="h-4 w-4 rounded border-[var(--border)] text-[var(--brand)]" />
            {t("journal.remindOnDate")}
          </label>
          {hasDueDate && (
            <Field label={t("common.date")} hint={t("journal.dateReflectsCalendar")}>
              <Input name="due_at" type="datetime-local" defaultValue={localValue(defaultDue)} />
            </Field>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pending}>{pending ? t("common.saving") : t("common.save")}</Button>
            {state?.error && <span className="text-sm text-red-400">{state.error}</span>}
          </div>
        </form>
      </Card>
    </div>
  );
}
