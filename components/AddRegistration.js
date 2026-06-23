"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { addRegistration } from "@/app/(app)/events/actions";
import { Button, Field, Input, Select } from "@/components/ui";
import Combobox from "@/components/Combobox";
import { EVENT_REG_STATUSES } from "@/lib/constants";

export default function AddRegistration({ eventId, contacts, groups }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(addRegistration, {});
  const [mode, setMode] = useState("existing"); // existing | new
  const [contactId, setContactId] = useState("");
  const [groupId, setGroupId] = useState("");

  useEffect(() => {
    if (state?.ok) { setContactId(""); setGroupId(""); }
  }, [state?.ok]);

  const contactOpts = contacts.map((c) => ({
    value: c.id,
    label: c.full_name + (c.company?.name ? ` · ${c.company.name}` : ""),
  }));
  const groupOpts = (groups || []).map((g) => ({ value: g.id, label: g.name }));

  return (
    <div>
      {/* Mode toggle */}
      <div className="mb-3 flex overflow-hidden rounded-lg border border-[var(--border)] w-fit">
        {["existing", "new"].map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)}
            className={"px-3 py-1 text-sm transition-colors " +
              (mode === m ? "bg-[var(--brand)] text-white" : "text-[var(--muted)] hover:bg-[var(--background)]")}>
            {t(`deals.${m === "existing" ? "repExisting" : "repNew"}`)}
          </button>
        ))}
      </div>

      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="registration_source" value="event" />

        {mode === "existing" ? (
          <div className="min-w-64 flex-1">
            <Field label={t("events.pickContact")}>
              <Combobox
                name="contact_id"
                options={contactOpts}
                value={contactId}
                onChange={setContactId}
                placeholder={t("events.pickContact")}
              />
            </Field>
          </div>
        ) : (
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t("common.fullName")} required>
              <Input name="full_name" />
            </Field>
            <Field label={t("contacts.company")}>
              <Input name="company_name" />
            </Field>
            <Field label={t("contacts.jobTitle")}>
              <Input name="job_title" />
            </Field>
            <Field label={t("common.email")}>
              <Input name="email" type="email" />
            </Field>
            <Field label={t("common.phone")}>
              <Input name="phone" />
            </Field>
            <Field label={t("contacts.linkedin")}>
              <Input name="linkedin" placeholder="https://linkedin.com/in/…" />
            </Field>
          </div>
        )}

        {groupOpts.length > 0 && (
          <div className="w-44">
            <Field label={t("groups.label")}>
              <Combobox
                name="group_id"
                options={groupOpts}
                value={groupId}
                onChange={setGroupId}
                placeholder={t("groups.noGroup")}
              />
            </Field>
          </div>
        )}
        <div className="w-44">
          <Field label={t("bridge.status")}>
            <Select name="status" defaultValue="desiderata">
              {EVENT_REG_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`bridge.statuses.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Button type="submit" disabled={pending || (mode === "existing" && !contactId)}>
          {pending ? t("common.saving") : t("common.add")}
        </Button>
        {state?.error === "already_added" && (
          <p className="w-full text-sm text-amber-700">—</p>
        )}
        {state?.error === "name_required" && (
          <p className="w-full text-sm text-red-700">{t("common.required")}</p>
        )}
      </form>
    </div>
  );
}
