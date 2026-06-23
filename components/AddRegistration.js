"use client";

import { useActionState, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { addRegistration } from "@/app/(app)/events/actions";
import { Button, Field, Select } from "@/components/ui";
import Combobox from "@/components/Combobox";
import { EVENT_REG_STATUSES } from "@/lib/constants";

export default function AddRegistration({ eventId, contacts }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(addRegistration, {});
  const [contactId, setContactId] = useState("");

  useEffect(() => {
    if (state?.ok) setContactId("");
  }, [state?.ok]);

  const contactOpts = contacts.map((c) => ({
    value: c.id,
    label: c.full_name + (c.company?.name ? ` · ${c.company.name}` : ""),
  }));

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="event_id" value={eventId} />
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
      <Button type="submit" disabled={pending || !contactId}>
        {pending ? t("common.saving") : t("common.add")}
      </Button>
      {state?.error === "already_added" && (
        <p className="w-full text-sm text-amber-700">—</p>
      )}
    </form>
  );
}
