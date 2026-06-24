"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Textarea } from "@/components/ui";
import DeleteButton from "@/components/DeleteButton";
import AddRegistration from "@/components/AddRegistration";
import {
  addEventGroup,
  confirmRsvp,
  deleteEvent,
  deleteGroup,
  removeRegistration,
  updateRegistrationStatus,
} from "@/app/(app)/events/actions";
import { EVENT_REG_STATUSES } from "@/lib/constants";

const RSVP_COLOR = { yes: "green", no: "red", maybe: "amber" };
const STATUS_COLOR = { desiderata: "gray", invited: "blue", registered: "purple", waiting_list: "amber", confirmed: "green", declined: "red", attended: "green", no_show: "red" };
const STATUS_LABEL = { desiderata: "To invite", invited: "Invited", registered: "Registered", waiting_list: "Waiting list", confirmed: "Confirmed / will come", declined: "Declined / will not come", attended: "Attended", no_show: "No-show" };

export default function EventDetail({ event, registrations, contacts, groups, owners }) {
  const { t } = useTranslation();
  const info = [event.location, event.start_date, event.end_date]
    .filter(Boolean)
    .join(" · ");
  const [activeGroup, setActiveGroup] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [rsvpFilter, setRsvpFilter] = useState("");

  const ownerTextFromNotes = (r) => String(r.notes || "").match(/Responsible from Excel:\s*([^|]+)/)?.[1]?.trim() || null;
  const textualOwners = Array.from(new Set((registrations || []).map(ownerTextFromNotes).filter(Boolean))).sort();

  const filtered = registrations.filter((r) => {
    if (activeGroup === "none" && r.group_id) return false;
    if (activeGroup !== "all" && activeGroup !== "none" && r.group_id !== activeGroup) return false;
    if (ownerFilter && r.requested_by !== ownerFilter && ownerTextFromNotes(r) !== ownerFilter) return false;
    if (sourceFilter && (r.registration_source || "event") !== sourceFilter) return false;
    if (rsvpFilter === "none" && r.rsvp) return false;
    if (rsvpFilter && rsvpFilter !== "none" && r.rsvp !== rsvpFilter) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <Button variant="ghost" href="/events">
          ← {t("common.back")}
        </Button>
      </div>

      <PageHeader title={event.name} subtitle={info || undefined}>
        <Button variant="secondary" href={`/events/${event.id}/edit`}>
          {t("common.edit")}
        </Button>
        <DeleteButton
          action={deleteEvent}
          id={event.id}
          confirmText={t("events.deleteConfirm")}
        />
      </PageHeader>

      {event.description && (
        <Card className="mb-4 p-5">
          <p className="whitespace-pre-wrap text-sm">{event.description}</p>
        </Card>
      )}

      <Card className="mb-4 p-5">
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">
          {t("events.addContactToEvent")}
        </h2>
        <AddRegistration eventId={event.id} contacts={contacts} groups={groups} />
      </Card>

      {/* Group tabs */}
      <EventGroupManager eventId={event.id} groups={groups} activeGroup={activeGroup} onSelect={setActiveGroup} total={registrations.length} />

      {/* Filters: responsible person / source / rsvp */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="w-52">
          <Select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
            <option value="">{t("events.allResponsible")}</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>{o.full_name || o.email}</option>
            ))}
            {textualOwners.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </Select>
        </div>
        <div className="w-40">
          <Select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="">{t("events.allSources")}</option>
            <option value="event">{t("events.sourceEvent")}</option>
            <option value="sales">{t("events.sourceSales")}</option>
          </Select>
        </div>
        <div className="w-40">
          <Select value={rsvpFilter} onChange={(e) => setRsvpFilter(e.target.value)}>
            <option value="">{t("events.allRsvp")}</option>
            <option value="yes">{t("rsvp.yes")}</option>
            <option value="no">{t("rsvp.no")}</option>
            <option value="maybe">{t("rsvp.maybe")}</option>
            <option value="none">{t("rsvp.none")}</option>
          </Select>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-semibold">
        {t("events.registrations")} ({filtered.length})
      </h2>

      {filtered.length === 0 ? (
        <EmptyState>—</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Person</th>
                <th className="px-4 py-3 font-medium">Company / role</th>
                <th className="px-4 py-3 font-medium">Contact</th>
                <th className="px-4 py-3 font-medium">Responsible</th>
                <th className="px-4 py-3 font-medium">Response mail</th>
                <th className="px-4 py-3 font-medium">Registration status</th>
                <th className="px-4 py-3 font-medium">Attendance</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <RegistrationRow key={r.id} reg={r} eventId={event.id} groups={groups} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function EventGroupManager({ eventId, groups, activeGroup, onSelect, total }) {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const [state, action, pending] = useActionState(addEventGroup, {});
  const [delPending, startDelTransition] = useTransition();

  useEffect(() => {
    if (state?.ok) setShowAdd(false);
  }, [state?.ok]);

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onSelect("all")}
          className={"rounded-full px-3 py-1 text-sm transition-colors " + (activeGroup === "all" ? "bg-[var(--brand)] text-white" : "bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--background)]")}>
          {t("common.all")} ({total})
        </button>
        {groups.map((g) => (
          <span key={g.id} className="flex items-center gap-1">
            <button type="button" onClick={() => onSelect(g.id)}
              className={"rounded-full px-3 py-1 text-sm transition-colors " + (activeGroup === g.id ? "bg-[var(--brand)] text-white" : "bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--background)]")}>
              {g.name}
            </button>
            <button type="button" disabled={delPending}
              onClick={() => startDelTransition(() => deleteGroup(g.id, eventId))}
              className="text-xs text-[var(--muted)] hover:text-red-600">✕</button>
          </span>
        ))}
        <button type="button" onClick={() => onSelect("none")}
          className={"rounded-full px-3 py-1 text-sm transition-colors " + (activeGroup === "none" ? "bg-[var(--brand)] text-white" : "bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--background)]")}>
          {t("groups.none")}
        </button>
        <button type="button" onClick={() => setShowAdd((v) => !v)}
          className="rounded-full border border-dashed border-[var(--border)] px-3 py-1 text-sm text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]">
          + {t("groups.add")}
        </button>
      </div>
      {showAdd && (
        <form action={action} className="mt-3 flex items-center gap-2">
          <input type="hidden" name="event_id" value={eventId} />
          <Input name="name" placeholder={t("groups.addPlaceholder")} className="max-w-xs" />
          <Button type="submit" disabled={pending}>{t("common.add")}</Button>
          <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>{t("common.cancel")}</Button>
        </form>
      )}
    </div>
  );
}

function RegistrationRow({ reg, eventId, groups }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const c = reg.contact || {};
  const responsible = reg.responsible;
  const ownerTextFromNotes = String(reg.notes || "").match(/Responsible from Excel:\s*([^|]+)/)?.[1]?.trim() || null;
  const responsibleLabel = responsible?.full_name || responsible?.email || ownerTextFromNotes || null;
  const source = reg.registration_source || "event";
  const group = (groups || []).find((g) => g.id === reg.group_id);
  const history = [...(reg.history || [])].sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));

  return (
    <>
      <tr className="border-b border-[var(--border)] last:border-0 align-top">
        <td className="px-4 py-3 font-medium">
          <Link href={`/contacts/${c.id}`} className="hover:underline">{c.full_name || "—"}</Link>
        </td>
        <td className="px-4 py-3">
          <div>{c.company?.name || "—"}</div>
          {c.job_title && <div className="mt-1 text-xs text-[var(--muted)]">{c.job_title}</div>}
        </td>
        <td className="px-4 py-3 text-[var(--muted)]">
          {c.email ? <a href={`mailto:${c.email}`} className="block hover:underline">{c.email}</a> : null}
          {c.phone ? <a href={`tel:${c.phone}`} className="block hover:underline">{c.phone}</a> : null}
          {!c.email && !c.phone ? "—" : null}
        </td>
        <td className="px-4 py-3">
          {responsibleLabel ? <Badge color="blue">{responsibleLabel}</Badge> : <span className="text-xs text-[var(--muted)]">—</span>}
        </td>
        <td className="px-4 py-3 text-[var(--muted)]">{reg.response_date || "—"}</td>
        <td className="px-4 py-3"><Badge color={STATUS_COLOR[reg.status] || "gray"}>{STATUS_LABEL[reg.status] || reg.status || "Registered"}</Badge></td>
        <td className="px-4 py-3">{reg.rsvp ? <Badge color={RSVP_COLOR[reg.rsvp]}>{reg.rsvp === "yes" ? "Yes" : reg.rsvp === "no" ? "No" : "Maybe"}</Badge> : <span className="text-xs text-[var(--muted)]">Not set</span>}</td>
        <td className="px-4 py-3 text-right">
          <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">Details {open ? "▴" : "▾"}</button>
        </td>
      </tr>

      {open && (
        <tr className="border-b border-[var(--border)] bg-[var(--background)]">
          <td colSpan={8} className="px-4 py-4">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="space-y-1 text-sm">
                <Info label="Job title" value={c.job_title} />
                <Info label="Email" value={c.email ? <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a> : null} />
                <Info label="Phone" value={c.phone} />
                <Info label="Source list / sheet" value={group?.name || c.source} />
                <Info label="Import source" value={source === "sales" ? "Sales team" : "Event team"} />
                <Info label="Last note" value={reg.last_note || reg.notes} />
                <div className="pt-2">
                  <p className="mb-1 text-xs text-[var(--muted)]">Final status</p>
                  <StatusSelect reg={reg} eventId={eventId} />
                  <p className="mt-1 text-xs text-[var(--muted)]">Changing to Confirmed sets Attendance to Yes; Declined sets it to No.</p>
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs text-[var(--muted)]">Attendance / latest decision</p>
                <RsvpEditor reg={reg} eventId={eventId} />
              </div>

              <div>
                <p className="mb-1 text-xs text-[var(--muted)]">Change history</p>
                {history.length === 0 ? <p className="text-sm text-[var(--muted)]">No history yet</p> : (
                  <ul className="space-y-2">
                    {history.map((h, i) => (
                      <li key={i} className="text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          {h.status && <Badge color={STATUS_COLOR[h.status] || "gray"}>{STATUS_LABEL[h.status] || h.status}</Badge>}
                          {h.rsvp && <Badge color={RSVP_COLOR[h.rsvp] || "gray"}>{h.rsvp}</Badge>}
                          <span className="text-[var(--muted)]">{new Date(h.changed_at).toLocaleString()}</span>
                          {h.changed_by?.full_name && <span className="text-[var(--muted)]">· {h.changed_by.full_name}</span>}
                        </div>
                        {h.note && <p className="mt-0.5 pl-1">{h.note}</p>}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3"><RemoveButton regId={reg.id} eventId={eventId} /></div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function RsvpEditor({ reg, eventId }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(confirmRsvp, {});
  const [sel, setSel] = useState(reg.rsvp || "");
  const formRef = useRef(null);

  useEffect(() => {
    if (state?.ok && formRef.current) {
      const ta = formRef.current.querySelector("textarea[name='note']");
      if (ta) ta.value = "";
    }
  }, [state?.ok]);

  const activeCls = {
    yes: "bg-green-600 text-white",
    no: "bg-red-600 text-white",
    maybe: "bg-amber-500 text-white",
  };

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="reg_id" value={reg.id} />
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="rsvp" value={sel} />
      <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border)]">
        {["yes", "no", "maybe"].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setSel(sel === v ? "" : v)}
            className={
              "px-3 py-1 text-xs transition-colors " +
              (sel === v ? activeCls[v] : "text-[var(--muted)] hover:bg-[var(--surface)]")
            }
          >
            {t(`rsvp.${v}`)}
          </button>
        ))}
      </div>
      <Textarea name="note" placeholder={t("rsvp.note")} className="text-sm" />
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : t("rsvp.confirm")}
        </Button>
        {state?.ok && <span className="text-xs text-green-700">{t("common.saved")}</span>}
      </div>
    </form>
  );
}

function StatusSelect({ reg, eventId }) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  return (
    <select
      value={reg.status}
      disabled={pending}
      onChange={(e) =>
        startTransition(() => updateRegistrationStatus(reg.id, e.target.value, eventId))
      }
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm outline-none focus:border-[var(--brand)]"
    >
      {EVENT_REG_STATUSES.map((s) => (
        <option key={s} value={s}>
          {t(`bridge.statuses.${s}`)}
        </option>
      ))}
    </select>
  );
}

function RemoveButton({ regId, eventId }) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => removeRegistration(regId, eventId))}
      disabled={pending}
      className="text-xs text-red-600 hover:underline"
    >
      {t("common.delete")}
    </button>
  );
}

function Info({ label, value }) {
  if (!value) return null;
  return (
    <p>
      <span className="text-[var(--muted)]">{label}: </span>
      {value}
    </p>
  );
}
