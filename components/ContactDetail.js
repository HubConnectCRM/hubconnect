"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, Input, PageHeader, Select } from "@/components/ui";
import DeleteButton from "@/components/DeleteButton";
import Timeline from "@/components/Timeline";
import AddInteraction from "@/components/AddInteraction";
import AddToEvent from "@/components/AddToEvent";
import { deleteContact, logContactCall, shareContact } from "@/app/(app)/contacts/actions";
import { STATUS_COLORS } from "@/lib/constants";

const RSVP_COLOR = { yes: "green", no: "red", maybe: "amber" };

export default function ContactDetail({ contact, interactions, registrations, events, teammates = [], callLogs = [], shares = [] }) {
  const { t } = useTranslation();
  const location = [contact.city, contact.country].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4">
        <Button variant="ghost" href="/contacts">
          ← {t("common.back")}
        </Button>
      </div>

      <PageHeader
        title={contact.full_name || "—"}
        subtitle={contact.job_title || undefined}
      >
        {contact.gdpr_consent && <Badge color="green">GDPR ✓</Badge>}
        <Button variant="secondary" href={`/contacts/${contact.id}/edit`}>
          {t("common.edit")}
        </Button>
        <DeleteButton
          action={deleteContact}
          id={contact.id}
          confirmText={t("contacts.deleteConfirm")}
        />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-4 md:col-span-1">
          <Card className="space-y-3 p-5">
            <h2 className="text-sm font-semibold text-[var(--muted)]">
              {t("contacts.info")}
            </h2>
            <Row
              label={t("contacts.company")}
              value={
                contact.company ? (
                  <Link
                    href={`/companies/${contact.company.id}`}
                    className="text-[var(--brand)] hover:underline"
                  >
                    {contact.company.name}
                  </Link>
                ) : null
              }
            />
            <Row
              label={t("common.email")}
              value={
                contact.email ? (
                  <a href={`mailto:${contact.email}`} className="hover:underline">
                    {contact.email}
                  </a>
                ) : null
              }
            />
            <Row label={t("contacts.secondaryEmail")} value={contact.secondary_email} />
            <Row label={t("common.phone")} value={contact.phone} />
            <Row
              label={t("contacts.linkedin")}
              value={
                contact.linkedin ? (
                  <a
                    href={contact.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--brand)] hover:underline"
                  >
                    LinkedIn
                  </a>
                ) : null
              }
            />
            <Row label={t("contacts.owner")} value={contact.owner?.full_name || contact.owner?.email} />
            <Row label={t("contacts.source")} value={contact.source} />
            <Row label={t("companies.location")} value={location} />
            {contact.gdpr_consent && (
              <Row label={t("contacts.gdprConsentDate")} value={contact.gdpr_consent_date} />
            )}
            {contact.notes && (
              <div>
                <p className="text-xs text-[var(--muted)]">{t("common.notes")}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{contact.notes}</p>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">
              {t("contacts.events")}
            </h2>
            {registrations.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">—</p>
            ) : (
              <ul className="space-y-2">
                {registrations.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <Link
                      href={`/events/${r.event?.id}`}
                      className="text-sm hover:underline"
                    >
                      {r.event?.name}
                    </Link>
                    <span className="flex items-center gap-1">
                      {r.rsvp && (
                        <Badge color={RSVP_COLOR[r.rsvp]}>{t(`rsvp.${r.rsvp}`)}</Badge>
                      )}
                      <Badge color={STATUS_COLORS[r.status]}>
                        {t(`bridge.statuses.${r.status}`)}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <AddToEvent
              contactId={contact.id}
              events={events}
              existingEventIds={registrations.map((r) => r.event?.id).filter(Boolean)}
            />
          </Card>
        </div>

        <div className="space-y-4 md:col-span-2">
          <ContactCollaboration contact={contact} teammates={teammates} callLogs={callLogs} shares={shares} />
          <Card className="p-5">
            <h2 className="mb-3 text-lg font-semibold">{t("interactions.title")}</h2>
            <AddInteraction contactId={contact.id} />
          </Card>
          <Card className="p-5">
            <h2 className="mb-4 text-lg font-semibold">{t("contacts.timeline")}</h2>
            <Timeline interactions={interactions} contactId={contact.id} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function ContactCollaboration({ contact, teammates, callLogs, shares }) {
  const { t } = useTranslation();
  const [shareState, shareAction, sharePending] = useActionState(shareContact, {});
  const [callState, callAction, callPending] = useActionState(logContactCall, {});
  return <Card className="p-5"><h2 className="text-lg font-semibold">{t("contactCenter.title")}</h2><div className="mt-4 grid gap-5 lg:grid-cols-2"><form action={callAction} className="space-y-2"><input type="hidden" name="contact_id" value={contact.id} /><p className="text-sm font-medium">{t("contactCenter.logCall")}</p><Select name="interaction_type" defaultValue="Telefon"><option>Telefon</option><option>WhatsApp</option><option>FaceTime</option></Select><Select name="outcome" defaultValue="answered"><option value="answered">{t("contactCenter.spoke")}</option><option value="no_answer">{t("contactCenter.noAnswer")}</option></Select><Input name="note" placeholder={t("common.notes")} /><Button type="submit" disabled={callPending}>{t("common.save")}</Button>{callState?.error && <p className="text-xs text-red-500">{callState.error}</p>}</form><form action={shareAction} className="space-y-2"><input type="hidden" name="contact_id" value={contact.id} /><p className="text-sm font-medium">{t("contactCenter.share")}</p><Select name="shared_with" required defaultValue=""><option value="">{t("contactCenter.chooseTeammate")}</option>{teammates.map((person) => <option key={person.id} value={person.id}>{person.full_name || person.email}</option>)}</Select><Input name="note" placeholder={t("common.notes")} /><Button type="submit" disabled={sharePending}>{t("contactCenter.share")}</Button>{shareState?.ok && <p className="text-xs text-green-500">{t("common.saved")}</p>}</form></div>{(callLogs.length > 0 || shares.length > 0) && <div className="mt-5 border-t border-[var(--border)] pt-4"><div className="grid gap-2 md:grid-cols-2">{callLogs.slice(0,5).map((log) => <div key={log.id} className="rounded-xl bg-white/[0.03] p-3 text-xs"><strong>{log.interaction_type} · {t(`contactCenter.outcomes.${log.outcome || "answered"}`)}</strong><p className="mt-1 text-[var(--muted)]">{log.note || ""} · {new Date(log.created_at).toLocaleString()}</p></div>)}{shares.slice(0,5).map((share) => <div key={share.id} className="rounded-xl bg-white/[0.03] p-3 text-xs"><strong>{t("contactCenter.sharedWith", { name: share.shared_with_profile?.full_name || share.shared_with_profile?.email })}</strong><p className="mt-1 text-[var(--muted)]">{share.note || ""}</p></div>)}</div></div>}</Card>;
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}
