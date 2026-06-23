"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import Combobox from "@/components/Combobox";
import DeleteButton from "@/components/DeleteButton";
import {
  addLeadContact,
  addLeadGroup,
  deleteLeadFile,
  removeLeadContact,
  updateLeadContact,
} from "@/app/(app)/leads/actions";
import { deleteGroup } from "@/app/(app)/events/actions";

const RSVP_COLOR = { yes: "green", no: "red", maybe: "amber" };

export default function LeadFileDetail({ file, leadContacts, groups, contacts }) {
  const { t } = useTranslation();
  const [activeGroup, setActiveGroup] = useState("all");

  const filtered =
    activeGroup === "all"
      ? leadContacts
      : activeGroup === "none"
      ? leadContacts.filter((lc) => !lc.group_id)
      : leadContacts.filter((lc) => lc.group_id === activeGroup);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <Button variant="ghost" href="/leads">
          ← {t("common.back")}
        </Button>
      </div>

      <PageHeader title={file.name} subtitle={file.description || undefined}>
        <DeleteButton
          action={deleteLeadFile}
          id={file.id}
          confirmText={t("leads.deleteConfirm")}
        />
      </PageHeader>

      {/* Add contact */}
      <Card className="mb-4 p-5">
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">
          {t("leads.addContact")}
        </h2>
        <AddLeadContactForm
          leadFileId={file.id}
          contacts={contacts}
          groups={groups}
        />
      </Card>

      {/* Sub-groups management */}
      <GroupManager
        leadFileId={file.id}
        groups={groups}
        activeGroup={activeGroup}
        onSelect={setActiveGroup}
        total={leadContacts.length}
      />

      <h2 className="mb-3 text-lg font-semibold">
        {t("leads.contacts")} ({filtered.length})
      </h2>

      {filtered.length === 0 ? (
        <EmptyState>{t("leads.contactsEmpty")}</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("common.name")}</th>
                <th className="px-4 py-3 font-medium">{t("contacts.company")}</th>
                <th className="px-4 py-3 font-medium">{t("common.phone")}</th>
                <th className="px-4 py-3 font-medium">{t("groups.label")}</th>
                <th className="px-4 py-3 font-medium">{t("rsvp.label")}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lc) => (
                <LeadContactRow
                  key={lc.id}
                  lc={lc}
                  leadFileId={file.id}
                  groups={groups}
                />
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function AddLeadContactForm({ leadFileId, contacts, groups }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(addLeadContact, {});
  const [contactId, setContactId] = useState("");
  const [groupId, setGroupId] = useState("");

  useEffect(() => {
    if (state?.ok) {
      setContactId("");
      setGroupId("");
    }
  }, [state?.ok]);

  const contactOpts = contacts.map((c) => ({
    value: c.id,
    label: c.full_name + (c.company?.name ? ` · ${c.company.name}` : ""),
  }));
  const groupOpts = groups.map((g) => ({ value: g.id, label: g.name }));

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="lead_file_id" value={leadFileId} />
      <div className="min-w-64 flex-1">
        <Combobox
          name="contact_id"
          options={contactOpts}
          value={contactId}
          onChange={setContactId}
          placeholder={t("events.pickContact")}
        />
      </div>
      {groups.length > 0 && (
        <div className="w-48">
          <Combobox
            name="group_id"
            options={groupOpts}
            value={groupId}
            onChange={setGroupId}
            placeholder={t("groups.noGroup")}
          />
        </div>
      )}
      <Button type="submit" disabled={pending || !contactId}>
        {t("common.add")}
      </Button>
      {state?.error === "already_added" && (
        <p className="w-full text-sm text-amber-700">{t("leads.alreadyAdded")}</p>
      )}
      {state?.ok && (
        <p className="w-full text-sm text-green-700">{t("common.saved")}</p>
      )}
    </form>
  );
}

function GroupManager({ leadFileId, groups, activeGroup, onSelect, total }) {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const [state, action, pending] = useActionState(addLeadGroup, {});

  useEffect(() => {
    if (state?.ok) setShowAdd(false);
  }, [state?.ok]);

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onSelect("all")}
          className={
            "rounded-full px-3 py-1 text-sm transition-colors " +
            (activeGroup === "all"
              ? "bg-[var(--brand)] text-white"
              : "bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--background)]")
          }
        >
          {t("common.all")} ({total})
        </button>
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelect(g.id)}
            className={
              "rounded-full px-3 py-1 text-sm transition-colors " +
              (activeGroup === g.id
                ? "bg-[var(--brand)] text-white"
                : "bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--background)]")
            }
          >
            {g.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onSelect("none")}
          className={
            "rounded-full px-3 py-1 text-sm transition-colors " +
            (activeGroup === "none"
              ? "bg-[var(--brand)] text-white"
              : "bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--background)]")
          }
        >
          {t("groups.none")}
        </button>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-full border border-dashed border-[var(--border)] px-3 py-1 text-sm text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
        >
          + {t("groups.add")}
        </button>
      </div>

      {showAdd && (
        <form action={action} className="mt-3 flex items-center gap-2">
          <input type="hidden" name="lead_file_id" value={leadFileId} />
          <Input
            name="name"
            placeholder={t("groups.addPlaceholder")}
            className="max-w-xs"
          />
          <Button type="submit" disabled={pending}>
            {t("common.add")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>
            {t("common.cancel")}
          </Button>
        </form>
      )}
    </div>
  );
}

function LeadContactRow({ lc, leadFileId, groups }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const c = lc.contact || {};
  const group = groups.find((g) => g.id === lc.group_id);

  return (
    <>
      <tr className="border-b border-[var(--border)] last:border-0">
        <td className="px-4 py-3 font-medium">
          <a href={`/contacts/${c.id}`} className="hover:underline">
            {c.full_name || "—"}
          </a>
        </td>
        <td className="px-4 py-3 text-[var(--muted)]">{c.company?.name || "—"}</td>
        <td className="px-4 py-3 text-[var(--muted)]">
          {c.phone ? (
            <a href={`tel:${c.phone}`} className="hover:underline">
              {c.phone}
            </a>
          ) : (
            "—"
          )}
        </td>
        <td className="px-4 py-3">
          {group ? (
            <Badge color="blue">{group.name}</Badge>
          ) : (
            <span className="text-xs text-[var(--muted)]">—</span>
          )}
        </td>
        <td className="px-4 py-3">
          <RsvpToggle
            lc={lc}
            leadFileId={leadFileId}
          />
        </td>
        <td className="px-4 py-3 text-right">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {t("rsvp.details")} {open ? "▴" : "▾"}
          </button>
        </td>
      </tr>

      {open && (
        <tr className="border-b border-[var(--border)] bg-[var(--background)]">
          <td colSpan={6} className="px-4 py-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-sm">
              <div className="space-y-1">
                {c.job_title && <p><span className="text-[var(--muted)]">{t("contacts.jobTitle")}: </span>{c.job_title}</p>}
                {c.email && <p><span className="text-[var(--muted)]">{t("common.email")}: </span><a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a></p>}
                {c.linkedin && <p><a href={c.linkedin} target="_blank" rel="noreferrer" className="text-[var(--brand)] hover:underline">LinkedIn</a></p>}
                {c.owner && <p><span className="text-[var(--muted)]">{t("bridge.owner")}: </span>{c.owner.full_name || c.owner.email}</p>}
              </div>
              <div>
                <NotesEditor lc={lc} leadFileId={leadFileId} />
              </div>
            </div>
            <div className="mt-3">
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => removeLeadContact(lc.id, leadFileId))}
                className="text-xs text-red-600 hover:underline"
              >
                {t("common.delete")}
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function RsvpToggle({ lc, leadFileId }) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  const [val, setVal] = useState(lc.rsvp || "");

  function toggle(v) {
    const next = val === v ? null : v;
    setVal(next || "");
    startTransition(() => updateLeadContact(lc.id, { rsvp: next }, leadFileId));
  }

  const activeCls = { yes: "bg-green-600 text-white", no: "bg-red-600 text-white", maybe: "bg-amber-500 text-white" };

  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border)]">
      {["yes", "no", "maybe"].map((v) => (
        <button
          key={v}
          type="button"
          disabled={pending}
          onClick={() => toggle(v)}
          className={
            "px-2 py-0.5 text-xs transition-colors " +
            (val === v ? activeCls[v] : "text-[var(--muted)] hover:bg-[var(--surface)]")
          }
        >
          {t(`rsvp.${v}`)}
        </button>
      ))}
    </div>
  );
}

function NotesEditor({ lc, leadFileId }) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState(lc.notes || "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      await updateLeadContact(lc.id, { notes }, leadFileId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--muted)]">{t("common.notes")}</p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
      />
      <div className="flex items-center gap-2">
        <Button type="button" disabled={pending} onClick={save}>
          {t("common.save")}
        </Button>
        {saved && <span className="text-xs text-green-700">{t("common.saved")}</span>}
      </div>
    </div>
  );
}
