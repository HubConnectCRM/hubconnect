"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import Combobox from "@/components/Combobox";
import SalesAddContact from "@/components/SalesAddContact";
import { moveRegistration, removeRegistration } from "@/app/(app)/events/actions";

const RSVP_COLOR = { yes: "green", no: "red", maybe: "amber" };

export default function SalesView({ rows, owners, events, groups, contacts }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("");
  const [event, setEvent] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (owner && r.ownerId !== owner) return false;
      if (event && r.eventId !== event) return false;
      if (!term) return true;
      return (
        r.contactName.toLowerCase().includes(term) ||
        r.company.toLowerCase().includes(term) ||
        r.eventName.toLowerCase().includes(term) ||
        (r.lastNote || "").toLowerCase().includes(term) ||
        (r.email || "").toLowerCase().includes(term)
      );
    });
  }, [rows, q, owner, event]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("sales.title")} subtitle={t("sales.subtitle")} />

      <SalesAddContact contacts={contacts} events={events} groups={groups} />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-56 flex-1">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search")} />
        </div>
        <div className="w-52">
          <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">{t("contacts.allOwners")}</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.full_name || o.email}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-52">
          <Select value={event} onChange={(e) => setEvent(e.target.value)}>
            <option value="">{t("sales.allEvents")}</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <p className="mb-2 text-sm text-[var(--muted)]">
        {filtered.length} {t("import.rows")}
      </p>

      {filtered.length === 0 ? (
        <EmptyState>{q || owner || event ? t("common.noResults") : t("sales.empty")}</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("common.name")}</th>
                <th className="px-4 py-3 font-medium">{t("contacts.company")}</th>
                <th className="px-4 py-3 font-medium">{t("sales.event")}</th>
                <th className="px-4 py-3 font-medium">{t("contacts.owner")}</th>
                <th className="px-4 py-3 font-medium">{t("sales.attendance")}</th>
                <th className="px-4 py-3 font-medium">{t("sales.lastNote")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <SalesRow key={r.id} row={r} events={events} groups={groups} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function SalesRow({ row, events, groups }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr className="border-b border-[var(--border)] last:border-0">
        <td className="px-4 py-3 font-medium">{row.contactName}</td>
        <td className="px-4 py-3 text-[var(--muted)]">{row.company || "—"}</td>
        <td className="px-4 py-3">{row.eventName}</td>
        <td className="px-4 py-3 text-[var(--muted)]">{row.ownerName || "—"}</td>
        <td className="px-4 py-3">
          {row.rsvp ? (
            <Badge color={RSVP_COLOR[row.rsvp]}>{t(`rsvp.${row.rsvp}`)}</Badge>
          ) : (
            <span className="text-xs text-[var(--muted)]">{t("sales.notSet")}</span>
          )}
        </td>
        <td className="px-4 py-3 text-[var(--muted)]">
          {row.lastNote ? (
            <span title={row.lastNote}>
              {row.lastNote.length > 40 ? row.lastNote.slice(0, 40) + "…" : row.lastNote}
              {row.lastAt && (
                <span className="block text-xs">
                  {new Date(row.lastAt).toLocaleDateString()}
                </span>
              )}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {t("rsvp.details")} {open ? "▴" : "▾"}
          </button>
        </td>
      </tr>

      {open && (
        <tr className="border-b border-[var(--border)] bg-[var(--background)]">
          <td colSpan={7} className="px-4 py-4">
            <SalesRowDetail row={row} events={events} groups={groups} />
          </td>
        </tr>
      )}
    </>
  );
}

function SalesRowDetail({ row, events, groups }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [newEventId, setNewEventId] = useState(row.eventId);
  const [pending, startTransition] = useTransition();

  const eventOpts = events.map((e) => ({ value: e.id, label: e.name }));
  const eventGroups = groups.filter((g) => g.event_id === newEventId);
  const currentGroup = groups.find((g) => g.id === row.groupId);

  function handleMoveEvent() {
    if (newEventId === row.eventId) return;
    startTransition(async () => {
      await moveRegistration(row.id, newEventId);
      router.refresh();
    });
  }

  function handleRemove() {
    if (!confirm(t("common.confirmDelete"))) return;
    startTransition(async () => {
      await removeRegistration(row.id, row.eventId);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3 text-sm">
      {/* Contact info */}
      <div className="space-y-1">
        <p className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">{t("contacts.info")}</p>
        {row.jobTitle && <p><span className="text-[var(--muted)]">{t("contacts.jobTitle")}: </span>{row.jobTitle}</p>}
        {row.email && <p><span className="text-[var(--muted)]">{t("common.email")}: </span><a href={`mailto:${row.email}`} className="hover:underline">{row.email}</a></p>}
        {row.phone && <p><span className="text-[var(--muted)]">{t("common.phone")}: </span><a href={`tel:${row.phone}`} className="hover:underline">{row.phone}</a></p>}
        {row.linkedin && <p><a href={row.linkedin} target="_blank" rel="noreferrer" className="text-[var(--brand)] hover:underline">LinkedIn</a></p>}
        <p className="pt-1">
          <a href={`/contacts/${row.contactId}`} className="text-[var(--brand)] hover:underline text-xs">
            {t("common.view")} →
          </a>
        </p>
      </div>

      {/* Event assignment */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">{t("sales.event")}</p>
        <Combobox
          name="new_event"
          options={eventOpts}
          value={newEventId}
          onChange={setNewEventId}
          placeholder={t("sales.event")}
        />
        {currentGroup && (
          <p className="mt-1 text-xs text-[var(--muted)]">
            {t("groups.label")}: <Badge color="blue">{currentGroup.name}</Badge>
          </p>
        )}
        {newEventId !== row.eventId && (
          <Button
            type="button"
            className="mt-2"
            disabled={pending}
            onClick={handleMoveEvent}
          >
            {t("sales.moveEvent")}
          </Button>
        )}
      </div>

      {/* Actions */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">{t("common.actions")}</p>
        <a
          href={`/events/${row.eventId}`}
          className="block text-[var(--brand)] hover:underline text-xs mb-2"
        >
          {t("sales.openEvent")} →
        </a>
        <button
          type="button"
          disabled={pending}
          onClick={handleRemove}
          className="text-xs text-red-600 hover:underline"
        >
          {t("sales.removeFromEvent")}
        </button>
      </div>
    </div>
  );
}
