"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, PageHeader, Textarea } from "@/components/ui";
import DeleteButton from "@/components/DeleteButton";
import AddRegistration from "@/components/AddRegistration";
import {
  confirmRsvp,
  deleteEvent,
  removeRegistration,
  updateRegistrationStatus,
} from "@/app/(app)/events/actions";
import { EVENT_REG_STATUSES } from "@/lib/constants";

const RSVP_COLOR = { yes: "green", no: "red", maybe: "amber" };

export default function EventDetail({ event, registrations, contacts }) {
  const { t } = useTranslation();
  const info = [event.location, event.start_date, event.end_date]
    .filter(Boolean)
    .join(" · ");

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
        <AddRegistration eventId={event.id} contacts={contacts} />
      </Card>

      <h2 className="mb-3 text-lg font-semibold">
        {t("events.registrations")} ({registrations.length})
      </h2>

      {registrations.length === 0 ? (
        <EmptyState>—</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("common.name")}</th>
                <th className="px-4 py-3 font-medium">{t("contacts.company")}</th>
                <th className="px-4 py-3 font-medium">{t("common.phone")}</th>
                <th className="px-4 py-3 font-medium">{t("bridge.owner")}</th>
                <th className="px-4 py-3 font-medium">{t("rsvp.label")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((r) => (
                <RegistrationRow key={r.id} reg={r} eventId={event.id} />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function RegistrationRow({ reg, eventId }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const c = reg.contact || {};
  const owner = c.owner;
  const history = [...(reg.history || [])].sort(
    (a, b) => new Date(b.changed_at) - new Date(a.changed_at)
  );

  return (
    <>
      <tr className="border-b border-[var(--border)] last:border-0">
        <td className="px-4 py-3 font-medium">
          <Link href={`/contacts/${c.id}`} className="hover:underline">
            {c.full_name || "—"}
          </Link>
        </td>
        <td className="px-4 py-3 text-[var(--muted)]">{c.company?.name || "—"}</td>
        <td className="px-4 py-3 text-[var(--muted)]">
          {c.phone ? <a href={`tel:${c.phone}`} className="hover:underline">{c.phone}</a> : "—"}
        </td>
        <td className="px-4 py-3">
          {owner ? (
            <Badge color="blue">{owner.full_name || owner.email}</Badge>
          ) : (
            <span className="text-xs text-[var(--muted)]">{t("bridge.noOwner")}</span>
          )}
        </td>
        <td className="px-4 py-3">
          {reg.rsvp ? (
            <Badge color={RSVP_COLOR[reg.rsvp]}>{t(`rsvp.${reg.rsvp}`)}</Badge>
          ) : (
            <span className="text-xs text-[var(--muted)]">{t("rsvp.none")}</span>
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
          <td colSpan={6} className="px-4 py-4">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="space-y-1 text-sm">
                <Info label={t("contacts.jobTitle")} value={c.job_title} />
                <Info
                  label={t("common.email")}
                  value={
                    c.email ? (
                      <a href={`mailto:${c.email}`} className="hover:underline">
                        {c.email}
                      </a>
                    ) : null
                  }
                />
                <Info
                  label={t("contacts.linkedin")}
                  value={
                    c.linkedin ? (
                      <a href={c.linkedin} target="_blank" rel="noreferrer" className="text-[var(--brand)] hover:underline">
                        LinkedIn
                      </a>
                    ) : null
                  }
                />
                <Info label={t("contacts.source")} value={c.source} />
                <div className="pt-2">
                  <p className="mb-1 text-xs text-[var(--muted)]">{t("bridge.status")}</p>
                  <StatusSelect reg={reg} eventId={eventId} />
                </div>
              </div>

              <div>
                <p className="mb-1 text-xs text-[var(--muted)]">{t("rsvp.label")}</p>
                <RsvpEditor reg={reg} eventId={eventId} />
              </div>

              <div>
                <p className="mb-1 text-xs text-[var(--muted)]">{t("rsvp.history")}</p>
                {history.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">{t("rsvp.noHistory")}</p>
                ) : (
                  <ul className="space-y-2">
                    {history.map((h, i) => (
                      <li key={i} className="text-xs">
                        <div className="flex items-center gap-2">
                          <Badge color={RSVP_COLOR[h.rsvp] || "gray"}>
                            {h.rsvp ? t(`rsvp.${h.rsvp}`) : "—"}
                          </Badge>
                          <span className="text-[var(--muted)]">
                            {new Date(h.changed_at).toLocaleString()}
                          </span>
                          {h.changed_by?.full_name && (
                            <span className="text-[var(--muted)]">· {h.changed_by.full_name}</span>
                          )}
                        </div>
                        {h.note && <p className="mt-0.5 pl-1">{h.note}</p>}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3">
                  <RemoveButton regId={reg.id} eventId={eventId} />
                </div>
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
