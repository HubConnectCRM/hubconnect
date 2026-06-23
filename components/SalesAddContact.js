"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { addRegistration } from "@/app/(app)/events/actions";
import { Button, Card } from "@/components/ui";
import Combobox from "@/components/Combobox";

export default function SalesAddContact({ contacts, events, groups }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [state, action, pending] = useActionState(addRegistration, {});
  const [contactId, setContactId] = useState("");
  const [eventId, setEventId] = useState("");
  const [groupId, setGroupId] = useState("");

  useEffect(() => {
    if (state?.ok) {
      setContactId("");
      setEventId("");
      setGroupId("");
      router.refresh();
    }
  }, [state?.ok, router]);

  const contactOpts = contacts.map((c) => ({
    value: c.id,
    label: c.full_name + (c.company?.name ? ` · ${c.company.name}` : ""),
  }));
  const eventOpts = events.map((e) => ({ value: e.id, label: e.name }));
  const groupOpts = (groups || [])
    .filter((g) => g.event_id === eventId)
    .map((g) => ({ value: g.id, label: g.name }));

  return (
    <Card className="mb-4 p-5">
      <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">
        {t("events.addContactToEvent")}
      </h2>
      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="status" value="desiderata" />
        <input type="hidden" name="registration_source" value="sales" />
        <div className="min-w-64 flex-1">
          <Combobox
            name="contact_id"
            options={contactOpts}
            value={contactId}
            onChange={setContactId}
            placeholder={t("events.pickContact")}
          />
        </div>
        <div className="w-56">
          <Combobox
            name="event_id"
            options={eventOpts}
            value={eventId}
            onChange={(v) => { setEventId(v); setGroupId(""); }}
            placeholder={t("sales.event")}
          />
        </div>
        {groupOpts.length > 0 && (
          <div className="w-44">
            <Combobox
              name="group_id"
              options={groupOpts}
              value={groupId}
              onChange={setGroupId}
              placeholder={t("groups.noGroup")}
            />
          </div>
        )}
        <Button type="submit" disabled={pending || !contactId || !eventId}>
          {t("common.add")}
        </Button>
      </form>
      {state?.error === "already_added" && (
        <p className="mt-2 text-sm text-amber-700">{t("leads.alreadyAdded")}</p>
      )}
    </Card>
  );
}
