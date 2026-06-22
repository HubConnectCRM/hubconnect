"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { addInteraction } from "@/app/(app)/contacts/actions";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { INTERACTION_TYPES } from "@/lib/constants";

export default function AddInteraction({ contactId }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(addInteraction, {});
  const formRef = useRef(null);

  useEffect(() => {
    if (state?.ok && formRef.current) formRef.current.reset();
  }, [state?.ok]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="contact_id" value={contactId} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("interactions.type")}>
          <Select name="type" defaultValue="note">
            {INTERACTION_TYPES.map((tp) => (
              <option key={tp} value={tp}>
                {t(`interactions.types.${tp}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("interactions.occurredOn")}>
          <Input
            name="occurred_on"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </Field>
      </div>
      <Field label={t("interactions.topic")}>
        <Input name="topic" placeholder="" />
      </Field>
      <Field label={t("interactions.action")}>
        <Textarea name="action_text" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("interactions.nextStep")}>
          <Input name="next_step" />
        </Field>
        <Field label={t("interactions.nextStepDue")}>
          <Input name="next_step_due" type="date" />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : t("interactions.add")}
        </Button>
      </div>
    </form>
  );
}
