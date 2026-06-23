"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import Combobox from "@/components/Combobox";
import SalesAddContact from "@/components/SalesAddContact";
import { moveRegistration, removeRegistration } from "@/app/(app)/events/actions";
import { removeLeadContact, updateLeadContact } from "@/app/(app)/leads/actions";

const RSVP_COLOR = { yes: "green", no: "red", maybe: "amber" };

export default function SalesView({ rows, owners, events, leadFiles, groups, contacts }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("");
  const [fileFilter, setFileFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (owner && r.ownerId !== owner) return false;
      if (typeFilter && r.type !== typeFilter) return false;
      if (fileFilter && r.fileId !== fileFilter) return false;
      if (!term) return true;
      return (
        r.contactName.toLowerCase().includes(term) ||
        r.company.toLowerCase().includes(term) ||
        r.fileName.toLowerCase().includes(term) ||
        (r.lastNote || "").toLowerCase().includes(term) ||
        (r.email || "").toLowerCase().includes(term)
      );
    });
  }, [rows, q, owner, fileFilter, typeFilter]);

  const allFiles = [
    ...events.map((e) => ({ id: e.id, label: e.name, type: "event" })),
    ...leadFiles.map((f) => ({ id: f.id, label: f.name, type: "lead" })),
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("sales.title")} subtitle={t("sales.subtitle")} />

      <SalesAddContact contacts={contacts} events={events} leadFiles={leadFiles} groups={groups} />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-48 flex-1">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search")} />
        </div>
        <div className="w-44">
          <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">{t("contacts.allOwners")}</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.full_name || o.email}</option>
            ))}
          </Select>
        </div>
        <div className="w-36">
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">{t("common.all")}</option>
            <option value="event">{t("sales.typeEvent")}</option>
            <option value="lead">{t("sales.typeLead")}</option>
          </Select>
        </div>
        <div className="w-52">
          <Select value={fileFilter} onChange={(e) => setFileFilter(e.target.value)}>
            <option value="">{t("sales.allFiles")}</option>
            {events.length > 0 && (
              <optgroup label={t("sales.typeEvent")}>
                {events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </optgroup>
            )}
            {leadFiles.length > 0 && (
              <optgroup label={t("sales.typeLead")}>
                {leadFiles.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </optgroup>
            )}
          </Select>
        </div>
      </div>

      <p className="mb-2 text-sm text-[var(--muted)]">{filtered.length} {t("import.rows")}</p>

      {filtered.length === 0 ? (
        <EmptyState>{q || owner || fileFilter ? t("common.noResults") : t("sales.empty")}</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("common.name")}</th>
                <th className="px-4 py-3 font-medium">{t("contacts.company")}</th>
                <th className="px-4 py-3 font-medium">{t("sales.file")}</th>
                <th className="px-4 py-3 font-medium">{t("contacts.owner")}</th>
                <th className="px-4 py-3 font-medium">{t("sales.attendance")}</th>
                <th className="px-4 py-3 font-medium">{t("sales.lastNote")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <SalesRow key={`${r.type}-${r.id}`} row={r} events={events} leadFiles={leadFiles} groups={groups} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function SalesRow({ row, events, leadFiles, groups }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const group = groups.find((g) => g.id === row.groupId);

  return (
    <>
      <tr className="border-b border-[var(--border)] last:border-0">
        <td className="px-4 py-3 font-medium">{row.contactName}</td>
        <td className="px-4 py-3 text-[var(--muted)]">{row.company || "—"}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <Badge color={row.type === "event" ? "blue" : "purple"}>
              {row.type === "event" ? t("sales.typeEvent") : t("sales.typeLead")}
            </Badge>
            <span className="text-[var(--muted)]">{row.fileName}</span>
          </div>
          {group && <span className="mt-0.5 block text-xs text-[var(--muted)]">↳ {group.name}</span>}
        </td>
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
              {row.lastAt && <span className="block text-xs">{new Date(row.lastAt).toLocaleDateString()}</span>}
            </span>
          ) : "—"}
        </td>
        <td className="px-4 py-3 text-right">
          <button type="button" onClick={() => setOpen((o) => !o)}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
            {t("rsvp.details")} {open ? "▴" : "▾"}
          </button>
        </td>
      </tr>

      {open && (
        <tr className="border-b border-[var(--border)] bg-[var(--background)]">
          <td colSpan={7} className="px-4 py-4">
            {row.type === "event" ? (
              <EventRowDetail row={row} events={events} groups={groups} />
            ) : (
              <LeadRowDetail row={row} leadFiles={leadFiles} groups={groups} />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function EventRowDetail({ row, events, groups }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [newEventId, setNewEventId] = useState(row.fileId);
  const [pending, startTransition] = useTransition();
  const eventOpts = events.map((e) => ({ value: e.id, label: e.name }));

  function handleMove() {
    if (newEventId === row.fileId) return;
    startTransition(async () => { await moveRegistration(row.id, newEventId); router.refresh(); });
  }
  function handleRemove() {
    if (!confirm(t("common.confirmDelete"))) return;
    startTransition(async () => { await removeRegistration(row.id, row.fileId); router.refresh(); });
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3 text-sm">
      <ContactInfo row={row} t={t} />
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">{t("sales.typeEvent")}</p>
        <Combobox name="new_event" options={eventOpts} value={newEventId} onChange={setNewEventId} placeholder={t("sales.typeEvent")} />
        {newEventId !== row.fileId && (
          <Button type="button" className="mt-2" disabled={pending} onClick={handleMove}>{t("sales.moveEvent")}</Button>
        )}
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">{t("common.actions")}</p>
        <a href={`/events/${row.fileId}`} className="block text-[var(--brand)] hover:underline text-xs mb-2">{t("sales.openEvent")} →</a>
        <button type="button" disabled={pending} onClick={handleRemove} className="text-xs text-red-600 hover:underline">{t("sales.removeFromEvent")}</button>
      </div>
    </div>
  );
}

function LeadRowDetail({ row, leadFiles, groups }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [notes, setNotes] = useState(row.lastNote || "");
  const [rsvp, setRsvp] = useState(row.rsvp || "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleRemove() {
    if (!confirm(t("common.confirmDelete"))) return;
    startTransition(async () => { await removeLeadContact(row.id, row.fileId); router.refresh(); });
  }
  function handleSave() {
    startTransition(async () => {
      await updateLeadContact(row.id, { notes, rsvp: rsvp || null }, row.fileId);
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      router.refresh();
    });
  }
  function toggleRsvp(v) { setRsvp(rsvp === v ? "" : v); }

  const activeCls = { yes: "bg-green-600 text-white", no: "bg-red-600 text-white", maybe: "bg-amber-500 text-white" };

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3 text-sm">
      <ContactInfo row={row} t={t} />
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">{t("rsvp.label")}</p>
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border)] mb-3">
          {["yes", "no", "maybe"].map((v) => (
            <button key={v} type="button" onClick={() => toggleRsvp(v)}
              className={"px-3 py-1 text-xs transition-colors " + (rsvp === v ? activeCls[v] : "text-[var(--muted)] hover:bg-[var(--surface)]")}>
              {t(`rsvp.${v}`)}
            </button>
          ))}
        </div>
        <p className="mb-1 text-xs text-[var(--muted)]">{t("common.notes")}</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]" />
        <div className="mt-2 flex items-center gap-2">
          <Button type="button" disabled={pending} onClick={handleSave}>{t("common.save")}</Button>
          {saved && <span className="text-xs text-green-700">{t("common.saved")}</span>}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">{t("common.actions")}</p>
        <a href={`/leads/${row.fileId}`} className="block text-[var(--brand)] hover:underline text-xs mb-2">{t("sales.openLeadFile")} →</a>
        <button type="button" disabled={pending} onClick={handleRemove} className="text-xs text-red-600 hover:underline">{t("sales.removeFromFile")}</button>
      </div>
    </div>
  );
}

function ContactInfo({ row, t }) {
  return (
    <div className="space-y-1">
      <p className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">{t("contacts.info")}</p>
      {row.jobTitle && <p><span className="text-[var(--muted)]">{t("contacts.jobTitle")}: </span>{row.jobTitle}</p>}
      {row.email && <p><span className="text-[var(--muted)]">{t("common.email")}: </span><a href={`mailto:${row.email}`} className="hover:underline">{row.email}</a></p>}
      {row.phone && <p><span className="text-[var(--muted)]">{t("common.phone")}: </span><a href={`tel:${row.phone}`} className="hover:underline">{row.phone}</a></p>}
      {row.linkedin && <p><a href={row.linkedin} target="_blank" rel="noreferrer" className="text-[var(--brand)] hover:underline">LinkedIn</a></p>}
      <p className="pt-1"><a href={`/contacts/${row.contactId}`} className="text-[var(--brand)] hover:underline text-xs">{t("common.view")} →</a></p>
    </div>
  );
}
