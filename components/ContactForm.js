"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { saveContact, lookupDuplicate } from "@/app/(app)/contacts/actions";
import { Button, Card, Checkbox, Field, Input, Select, Textarea } from "@/components/ui";

export default function ContactForm({ contact, companies, owners, currentUserId, defaultCompanyName = "" }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(saveContact, {});
  const [gdpr, setGdpr] = useState(!!contact?.gdpr_consent);
  const [dup, setDup] = useState(null);

  async function checkDup(e) {
    const email = e.target.value.trim();
    if (!email) return setDup(null);
    const match = await lookupDuplicate(email, contact?.id || null);
    setDup(match);
  }

  return (
    <form action={action} className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" href="/contacts">
          ← {t("common.back")}
        </Button>
        <h1 className="text-2xl font-semibold">
          {contact?.id ? t("contacts.edit") : t("contacts.new")}
        </h1>
      </div>

      {contact?.id && <input type="hidden" name="id" value={contact.id} />}

      <Card className="space-y-4 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("contacts.firstName")}>
            <Input name="first_name" defaultValue={contact?.first_name || ""} />
          </Field>
          <Field label={t("contacts.lastName")}>
            <Input name="last_name" defaultValue={contact?.last_name || ""} />
          </Field>
          <Field label={t("contacts.jobTitle")}>
            <Input name="job_title" defaultValue={contact?.job_title || ""} />
          </Field>
          <Field label={t("contacts.company")}>
            <Input
              name="company_name"
              list="company-options"
              defaultValue={contact?.company?.name || defaultCompanyName}
              autoComplete="off"
            />
            <datalist id="company-options">
              {companies.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </Field>
          <Field label={t("common.email")}>
            <Input
              name="email"
              type="email"
              defaultValue={contact?.email || ""}
              onBlur={checkDup}
            />
          </Field>
          <Field label={t("contacts.secondaryEmail")}>
            <Input name="secondary_email" defaultValue={contact?.secondary_email || ""} />
          </Field>
          <Field label={t("common.phone")}>
            <Input name="phone" defaultValue={contact?.phone || ""} />
          </Field>
          <Field label={t("contacts.linkedin")}>
            <Input name="linkedin" defaultValue={contact?.linkedin || ""} />
          </Field>
          <Field label={t("contacts.owner")}>
            <Select name="owner_id" defaultValue={contact?.owner_id || currentUserId || ""}>
              <option value="">{t("contacts.unassigned")}</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.full_name || o.email}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("contacts.source")}>
            <Input name="source" defaultValue={contact?.source || ""} />
          </Field>
          <Field label={t("common.country")}>
            <Input name="country" defaultValue={contact?.country || ""} />
          </Field>
          <Field label={t("common.city")}>
            <Input name="city" defaultValue={contact?.city || ""} />
          </Field>
        </div>

        {dup && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t("contacts.duplicateWarning")}{" "}
            <Link href={`/contacts/${dup.id}`} className="font-medium underline">
              {dup.full_name} {dup.company?.name ? `· ${dup.company.name}` : ""}
            </Link>
          </p>
        )}

        <div className="rounded-lg border border-[var(--border)] p-3">
          <Checkbox
            name="gdpr_consent"
            label={t("contacts.gdprConsent")}
            checked={gdpr}
            onChange={(e) => setGdpr(e.target.checked)}
          />
          {gdpr && (
            <div className="mt-3">
              <Field label={t("contacts.gdprConsentDate")}>
                <Input
                  name="gdpr_consent_date"
                  type="date"
                  defaultValue={contact?.gdpr_consent_date || ""}
                />
              </Field>
            </div>
          )}
        </div>

        <Field label={t("common.notes")}>
          <Textarea name="notes" defaultValue={contact?.notes || ""} />
        </Field>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error === "name_required" ? t("common.required") : state.error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" href="/contacts">
            {t("common.cancel")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      </Card>
    </form>
  );
}
