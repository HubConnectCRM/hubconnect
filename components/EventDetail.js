"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import DeleteButton from "@/components/DeleteButton";
import AddRegistration from "@/components/AddRegistration";
import {
  deleteEvent,
  removeRegistration,
  updateRegistrationStatus,
} from "@/app/(app)/events/actions";
import { EVENT_REG_STATUSES } from "@/lib/constants";

export default function EventDetail({ event, registrations, contacts }) {
  const { t } = useTranslation();
  const info = [event.location, event.start_date, event.end_date]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto max-w-5xl">
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
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("common.name")}</th>
                <th className="px-4 py-3 font-medium">{t("contacts.company")}</th>
                <th className="px-4 py-3 font-medium">{t("bridge.owner")}</th>
                <th className="px-4 py-3 font-medium">{t("bridge.status")}</th>
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
  const [pending, startTransition] = useTransition();
  const owner = reg.contact?.owner;

  return (
    <tr className="border-b border-[var(--border)] last:border-0">
      <td className="px-4 py-3 font-medium">
        <Link href={`/contacts/${reg.contact?.id}`} className="hover:underline">
          {reg.contact?.full_name || "—"}
        </Link>
      </td>
      <td className="px-4 py-3 text-[var(--muted)]">
        {reg.contact?.company?.name || "—"}
      </td>
      <td className="px-4 py-3">
        {owner ? (
          <Badge color="blue">{owner.full_name || owner.email}</Badge>
        ) : (
          <span className="text-xs text-[var(--muted)]">{t("bridge.noOwner")}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <select
          value={reg.status}
          disabled={pending}
          onChange={(e) =>
            startTransition(() =>
              updateRegistrationStatus(reg.id, e.target.value, eventId)
            )
          }
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm outline-none focus:border-[var(--brand)]"
        >
          {EVENT_REG_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`bridge.statuses.${s}`)}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => startTransition(() => removeRegistration(reg.id, eventId))}
          disabled={pending}
          className="text-xs text-[var(--muted)] hover:text-red-600"
        >
          {t("common.delete")}
        </button>
      </td>
    </tr>
  );
}
