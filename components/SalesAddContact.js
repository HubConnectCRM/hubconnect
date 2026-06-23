"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { addRegistration } from "@/app/(app)/events/actions";
import { addLeadContact } from "@/app/(app)/leads/actions";
import { Button, Card, Select } from "@/components/ui";
import Combobox from "@/components/Combobox";

export default function SalesAddContact({ contacts, events, leadFiles, groups }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [contactId, setContactId] = useState("");
  const [fileType, setFileType] = useState("event"); // "event" | "lead"
  const [fileId, setFileId] = useState("");
  const [groupId, setGroupId] = useState("");

  const [eventState, eventAction, eventPending] = useActionState(addRegistration, {});
  const [leadState, leadAction, leadPending] = useActionState(addLeadContact, {});
  const pending = fileType === "event" ? eventPending : leadPending;
  const state = fileType === "event" ? eventState : leadState;

  useEffect(() => {
    if (state?.ok) {
      setContactId(""); setFileId(""); setGroupId("");
      router.refresh();
    }
  }, [state?.ok, router]);

  const contactOpts = contacts.map((c) => ({
    value: c.id,
    label: c.full_name + (c.company?.name ? ` · ${c.company.name}` : ""),
  }));
  const eventOpts = events.map((e) => ({ value: e.id, label: e.name }));
  const leadOpts = leadFiles.map((f) => ({ value: f.id, label: f.name }));
  const fileOpts = fileType === "event" ? eventOpts : leadOpts;
  const groupOpts = (groups || [])
    .filter((g) => fileType === "event" ? g.event_id === fileId : g.lead_file_id === fileId)
    .map((g) => ({ value: g.id, label: g.name }));

  return (
    <Card className="mb-4 p-5">
      <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">
        {t("sales.addContact")}
      </h2>
      <form
        action={fileType === "event" ? eventAction : leadAction}
        className="flex flex-wrap items-end gap-3"
      >
        {fileType === "event" ? (
          <>
            <input type="hidden" name="status" value="desiderata" />
            <input type="hidden" name="registration_source" value="sales" />
            <input type="hidden" name="event_id" value={fileId} />
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="contact_id" value={contactId} />
          </>
        ) : (
          <>
            <input type="hidden" name="lead_file_id" value={fileId} />
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="contact_id" value={contactId} />
          </>
        )}

        {/* Contact picker */}
        <div className="min-w-56 flex-1">
          <Combobox
            name="_contact_display"
            options={contactOpts}
            value={contactId}
            onChange={setContactId}
            placeholder={t("events.pickContact")}
          />
        </div>

        {/* Type toggle */}
        <div className="flex overflow-hidden rounded-lg border border-[var(--border)]">
          {["event", "lead"].map((tp) => (
            <button key={tp} type="button"
              onClick={() => { setFileType(tp); setFileId(""); setGroupId(""); }}
              className={"px-3 py-2 text-sm transition-colors " +
                (fileType === tp ? "bg-[var(--brand)] text-white" : "text-[var(--muted)] hover:bg-[var(--background)]")}>
              {t(`sales.type${tp.charAt(0).toUpperCase() + tp.slice(1)}`)}
            </button>
          ))}
        </div>

        {/* File picker */}
        <div className="w-52">
          <Combobox
            name="_file_display"
            options={fileOpts}
            value={fileId}
            onChange={(v) => { setFileId(v); setGroupId(""); }}
            placeholder={fileType === "event" ? t("sales.typeEvent") : t("sales.typeLead")}
          />
        </div>

        {/* Group picker — shown only when groups exist for selected file */}
        {groupOpts.length > 0 && (
          <div className="w-44">
            <Combobox
              name="_group_display"
              options={groupOpts}
              value={groupId}
              onChange={setGroupId}
              placeholder={t("groups.noGroup")}
            />
          </div>
        )}

        <Button type="submit" disabled={pending || !contactId || !fileId}>
          {t("common.add")}
        </Button>
      </form>
      {state?.error === "already_added" && (
        <p className="mt-2 text-sm text-amber-700">{t("leads.alreadyAdded")}</p>
      )}
    </Card>
  );
}
