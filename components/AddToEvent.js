"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { addRegistration } from "@/app/(app)/events/actions";
import { Button, Select } from "@/components/ui";

export default function AddToEvent({ contactId, events, existingEventIds }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [state, action, pending] = useActionState(addRegistration, {});

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);

  const available = events.filter((e) => !existingEventIds.includes(e.id));
  if (available.length === 0) return null;

  return (
    <form action={action} className="mt-3 flex gap-2">
      <input type="hidden" name="contact_id" value={contactId} />
      <input type="hidden" name="status" value="desiderata" />
      <Select name="event_id" required defaultValue="">
        <option value="" disabled>
          {t("events.addContact")}…
        </option>
        {available.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </Select>
      <Button type="submit" disabled={pending}>
        {t("common.add")}
      </Button>
    </form>
  );
}
