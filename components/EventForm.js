"use client";

import { useActionState } from "react";
import { useTranslation } from "react-i18next";
import { saveEvent } from "@/app/(app)/events/actions";
import { Button, Card, Field, Input, Textarea } from "@/components/ui";

export default function EventForm({ event }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(saveEvent, {});

  return (
    <form action={action} className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" href="/events">
          ← {t("common.back")}
        </Button>
        <h1 className="text-2xl font-semibold">
          {event?.id ? t("events.edit") : t("events.new")}
        </h1>
      </div>

      {event?.id && <input type="hidden" name="id" value={event.id} />}

      <Card className="space-y-4 p-6">
        <Field label={t("common.name")} required>
          <Input name="name" defaultValue={event?.name || ""} required />
        </Field>
        <Field label={t("events.location")}>
          <Input name="location" defaultValue={event?.location || ""} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("events.startDate")}>
            <Input name="start_date" type="date" defaultValue={event?.start_date || ""} />
          </Field>
          <Field label={t("events.endDate")}>
            <Input name="end_date" type="date" defaultValue={event?.end_date || ""} />
          </Field>
        </div>
        <Field label={t("events.description")}>
          <Textarea name="description" defaultValue={event?.description || ""} />
        </Field>

        {state?.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error === "name_required" ? t("common.required") : state.error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" href="/events">
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
