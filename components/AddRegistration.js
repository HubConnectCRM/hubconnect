"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { addRegistration } from "@/app/(app)/events/actions";
import { Button, Field, Select } from "@/components/ui";
import { EVENT_REG_STATUSES } from "@/lib/constants";

export default function AddRegistration({ eventId, contacts }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(addRegistration, {});
  const formRef = useRef(null);

  useEffect(() => {
    if (state?.ok && formRef.current) formRef.current.reset();
  }, [state?.ok]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="event_id" value={eventId} />
      <div className="min-w-64 flex-1">
        <Field label={t("events.pickContact")}>
          <Select name="contact_id" required defaultValue="">
            <option value="" disabled>
              {t("events.pickContact")}
            </option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name}
                {c.company?.name ? ` · ${c.company.name}` : ""}
              </option>
            ))}
          </Select>
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
      <Button type="submit" disabled={pending}>
        {pending ? t("common.saving") : t("common.add")}
      </Button>
      {state?.error === "already_added" && (
        <p className="w-full text-sm text-amber-700">{t("common.noResults")}</p>
      )}
    </form>
  );
}
