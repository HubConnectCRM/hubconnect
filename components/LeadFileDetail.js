"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import Combobox from "@/components/Combobox";
import DeleteButton from "@/components/DeleteButton";
import {
  addLeadGroup,
  deleteLeadFile,
  renameGroup,
} from "@/app/(app)/leads/actions";
import { deleteGroup } from "@/app/(app)/events/actions";
import {
  addRep,
  deleteDeal,
  pushDealToEvent,
  saveDeal,
  setDealStage,
  removeRep,
  updateRep,
} from "@/app/(app)/deals/actions";

const STAGES = ["prospect", "in_progress", "won", "lost"];
const STAGE_COLOR = { prospect: "gray", in_progress: "amber", won: "green", lost: "red" };
const RSVP_COLOR = { yes: "green", no: "red", maybe: "amber" };

export default function LeadFileDetail({ file, deals, groups, companies, contacts, events, owners }) {
  const { t } = useTranslation();
  const [activeGroup, setActiveGroup] = useState("all");

  const filtered =
    activeGroup === "all"
      ? deals
      : activeGroup === "none"
      ? deals.filter((d) => !d.group_id)
      : deals.filter((d) => d.group_id === activeGroup);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <Button variant="ghost" href="/leads">← {t("common.back")}</Button>
      </div>

      <PageHeader title={file.name} subtitle={file.description || undefined}>
        <DeleteButton action={deleteLeadFile} id={file.id} confirmText={t("leads.deleteConfirm")} />
      </PageHeader>

      <Card className="mb-4 p-5">
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">{t("deals.add")}</h2>
        <AddDealForm leadFileId={file.id} companies={companies} groups={groups} owners={owners} />
      </Card>

      <GroupManager leadFileId={file.id} groups={groups} activeGroup={activeGroup} onSelect={setActiveGroup} total={deals.length} />

      <h2 className="mb-3 text-lg font-semibold">{t("deals.title")} ({filtered.length})</h2>

      {filtered.length === 0 ? (
        <EmptyState>{t("deals.empty")}</EmptyState>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => (
            <DealCard
              key={d.id}
              deal={d}
              leadFileId={file.id}
              groups={groups}
              contacts={contacts}
              events={events}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AddDealForm({ leadFileId, companies, groups, owners }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(saveDeal, {});
  const [companyName, setCompanyName] = useState("");
  const [groupId, setGroupId] = useState("");

  useEffect(() => { if (state?.ok) { setCompanyName(""); setGroupId(""); } }, [state?.ok]);

  const companyOpts = companies.map((c) => ({ value: c.name, label: c.name }));
  const groupOpts = groups.map((g) => ({ value: g.id, label: g.name }));

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="lead_file_id" value={leadFileId} />
      <input type="hidden" name="company_name" value={companyName} />
      <input type="hidden" name="group_id" value={groupId} />
      <div className="min-w-56 flex-1">
        <Field label={t("deals.company")}>
          <Combobox
            name="_company_display"
            options={companyOpts}
            value={companyName}
            onChange={setCompanyName}
            placeholder={t("deals.companyPlaceholder")}
            allowCustom
          />
        </Field>
      </div>
      {groupOpts.length > 0 && (
        <div className="w-44">
          <Field label={t("groups.label")}>
            <Combobox name="_group_display" options={groupOpts} value={groupId} onChange={setGroupId} placeholder={t("groups.noGroup")} />
          </Field>
        </div>
      )}
      <div className="w-44">
        <Field label={t("deals.owner")}>
          <Select name="owner_id" defaultValue="">
            <option value="">{t("deals.me")}</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.full_name || o.email}</option>)}
          </Select>
        </Field>
      </div>
      <div className="w-40">
        <Field label={t("deals.stage")}>
          <Select name="stage" defaultValue="prospect">
            {STAGES.map((s) => <option key={s} value={s}>{t(`deals.stages.${s}`)}</option>)}
          </Select>
        </Field>
      </div>
      <Button type="submit" disabled={pending || !companyName}>{t("common.add")}</Button>
      {state?.error && <p className="w-full text-sm text-red-700">{state.error === "company_required" ? t("deals.companyRequired") : state.error}</p>}
    </form>
  );
}

function DealCard({ deal, leadFileId, groups, contacts, events }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const reps = deal.reps || [];
  const group = groups.find((g) => g.id === deal.group_id);
  const companyLabel = deal.company?.name || deal.company_name || "—";

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex flex-1 items-center gap-3 text-left">
          <span className="text-[var(--muted)]">{open ? "▾" : "▸"}</span>
          <span className="font-semibold">{companyLabel}</span>
          {group && <Badge color="purple">{group.name}</Badge>}
          <Badge color={STAGE_COLOR[deal.stage]}>{t(`deals.stages.${deal.stage}`)}</Badge>
          <span className="text-sm text-[var(--muted)]">{reps.length} {t("deals.reps")}</span>
        </button>
        {deal.pushed_event_id ? (
          <Badge color="blue">{t("deals.pushedTo")}: {deal.pushed_event?.name || "—"}</Badge>
        ) : null}
        <span className="text-xs text-[var(--muted)]">{deal.owner?.full_name || deal.owner?.email || ""}</span>
      </div>

      {open && (
        <div className="border-t border-[var(--border)] bg-[var(--background)] p-4">
          {/* Stage + delete */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="text-xs text-[var(--muted)]">{t("deals.stage")}:</span>
            <StageSelect deal={deal} leadFileId={leadFileId} />
            <button
              type="button"
              disabled={pending}
              onClick={() => { if (confirm(t("deals.deleteConfirm"))) startTransition(() => deleteDeal(deal.id, leadFileId)); }}
              className="ml-auto text-xs text-red-600 hover:underline"
            >
              {t("deals.delete")}
            </button>
          </div>

          {/* Reps table */}
          {reps.length > 0 && (
            <div className="mb-4 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("deals.rep")}</th>
                    <th className="px-3 py-2 font-medium">{t("common.email")}</th>
                    <th className="px-3 py-2 font-medium">{t("common.phone")}</th>
                    <th className="px-3 py-2 font-medium">{t("rsvp.label")}</th>
                    <th className="px-3 py-2 font-medium">{t("common.notes")}</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {reps.map((r) => <RepRow key={r.id} rep={r} leadFileId={leadFileId} />)}
                </tbody>
              </table>
            </div>
          )}

          {/* Add rep */}
          <AddRepForm dealId={deal.id} leadFileId={leadFileId} contacts={contacts} />

          {/* Push to event */}
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <PushToEvent deal={deal} leadFileId={leadFileId} events={events} />
          </div>
        </div>
      )}
    </Card>
  );
}

function StageSelect({ deal, leadFileId }) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();
  return (
    <select
      value={deal.stage}
      disabled={pending}
      onChange={(e) => startTransition(() => setDealStage(deal.id, e.target.value, leadFileId))}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm outline-none focus:border-[var(--brand)]"
    >
      {STAGES.map((s) => <option key={s} value={s}>{t(`deals.stages.${s}`)}</option>)}
    </select>
  );
}

function RepRow({ rep, leadFileId }) {
  const { t } = useTranslation();
  const c = rep.contact || {};
  const [rsvp, setRsvp] = useState(rep.rsvp || "");
  const [notes, setNotes] = useState(rep.notes || "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function toggleRsvp(v) {
    const next = rsvp === v ? "" : v;
    setRsvp(next);
    startTransition(() => updateRep(rep.id, { rsvp: next || null }, leadFileId));
  }
  function saveNotes() {
    startTransition(async () => {
      await updateRep(rep.id, { notes }, leadFileId);
      setSaved(true); setTimeout(() => setSaved(false), 1500);
    });
  }
  const activeCls = { yes: "bg-green-600 text-white", no: "bg-red-600 text-white", maybe: "bg-amber-500 text-white" };

  return (
    <tr className="border-b border-[var(--border)] last:border-0 align-top">
      <td className="px-3 py-2 font-medium">
        <a href={`/contacts/${c.id}`} className="hover:underline">{c.full_name || "—"}</a>
        {c.job_title && <span className="block text-xs text-[var(--muted)]">{c.job_title}</span>}
      </td>
      <td className="px-3 py-2 text-[var(--muted)]">{c.email || "—"}</td>
      <td className="px-3 py-2 text-[var(--muted)]">{c.phone || "—"}</td>
      <td className="px-3 py-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border)]">
          {["yes", "no", "maybe"].map((v) => (
            <button key={v} type="button" disabled={pending} onClick={() => toggleRsvp(v)}
              className={"px-2 py-0.5 text-xs transition-colors " + (rsvp === v ? activeCls[v] : "text-[var(--muted)] hover:bg-[var(--background)]")}>
              {t(`rsvp.${v}`)}
            </button>
          ))}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <input value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes}
            placeholder={t("deals.notePlaceholder")}
            className="w-40 rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs outline-none focus:border-[var(--brand)]" />
          {saved && <span className="text-xs text-green-700">✓</span>}
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        <button type="button" disabled={pending} onClick={() => startTransition(() => removeRep(rep.id, leadFileId))}
          className="text-xs text-red-600 hover:underline">{t("common.delete")}</button>
      </td>
    </tr>
  );
}

function AddRepForm({ dealId, leadFileId, contacts }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(addRep, {});
  const [mode, setMode] = useState("existing"); // existing | new
  const [contactId, setContactId] = useState("");

  useEffect(() => { if (state?.ok) setContactId(""); }, [state?.ok]);

  const contactOpts = contacts.map((c) => ({
    value: c.id,
    label: c.full_name + (c.company?.name ? ` · ${c.company.name}` : ""),
  }));

  return (
    <div className="rounded-lg border border-dashed border-[var(--border)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <p className="text-xs font-semibold text-[var(--muted)]">{t("deals.addRep")}</p>
        <div className="flex overflow-hidden rounded-lg border border-[var(--border)]">
          {["existing", "new"].map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={"px-2 py-0.5 text-xs transition-colors " + (mode === m ? "bg-[var(--brand)] text-white" : "text-[var(--muted)] hover:bg-[var(--background)]")}>
              {t(`deals.${m === "existing" ? "repExisting" : "repNew"}`)}
            </button>
          ))}
        </div>
      </div>
      <form action={action} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="deal_id" value={dealId} />
        <input type="hidden" name="lead_file_id" value={leadFileId} />
        {mode === "existing" ? (
          <>
            <input type="hidden" name="contact_id" value={contactId} />
            <div className="min-w-56 flex-1">
              <Combobox name="_rep_display" options={contactOpts} value={contactId} onChange={setContactId} placeholder={t("events.pickContact")} />
            </div>
            <Button type="submit" disabled={pending || !contactId}>{t("common.add")}</Button>
          </>
        ) : (
          <>
            <Input name="full_name" placeholder={t("common.fullName")} className="w-44" />
            <Input name="email" type="email" placeholder={t("common.email")} className="w-44" />
            <Input name="phone" placeholder={t("common.phone")} className="w-36" />
            <Input name="job_title" placeholder={t("contacts.jobTitle")} className="w-36" />
            <Button type="submit" disabled={pending}>{t("common.add")}</Button>
          </>
        )}
        {state?.error === "already_added" && <p className="w-full text-xs text-amber-700">{t("deals.repAlready")}</p>}
        {state?.error === "name_required" && <p className="w-full text-xs text-red-700">{t("common.required")}</p>}
      </form>
    </div>
  );
}

function PushToEvent({ deal, leadFileId, events }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [state, action, pending] = useActionState(pushDealToEvent, {});
  const [eventId, setEventId] = useState(deal.pushed_event_id || "");
  const [newName, setNewName] = useState("");
  const [creatingNew, setCreatingNew] = useState(false);

  useEffect(() => { if (state?.ok) router.refresh(); }, [state?.ok, router]);

  const eventOpts = events.map((e) => ({ value: e.id, label: e.name }));
  const canPush = (deal.reps || []).length > 0 && (creatingNew ? newName.trim() : eventId);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="deal_id" value={deal.id} />
      <input type="hidden" name="lead_file_id" value={leadFileId} />
      <input type="hidden" name="event_id" value={creatingNew ? "" : eventId} />
      <input type="hidden" name="new_event_name" value={creatingNew ? newName : ""} />
      <div>
        <p className="mb-1 text-xs font-semibold text-[var(--muted)]">
          {deal.pushed_event_id ? t("deals.repushHint") : t("deals.pushHint")}
        </p>
        {creatingNew ? (
          <div className="flex items-center gap-2">
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t("deals.newEventName")} className="w-56" />
            <button type="button" onClick={() => setCreatingNew(false)} className="text-xs text-[var(--muted)] hover:underline">{t("deals.pickExisting")}</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-56">
              <Combobox name="_event_display" options={eventOpts} value={eventId} onChange={setEventId} placeholder={t("deals.pickEvent")} />
            </div>
            <button type="button" onClick={() => setCreatingNew(true)} className="text-xs text-[var(--brand)] hover:underline">+ {t("deals.newEvent")}</button>
          </div>
        )}
      </div>
      <Button type="submit" disabled={pending || !canPush}>
        {pending ? t("common.saving") : deal.pushed_event_id ? t("deals.repush") : t("deals.push")}
      </Button>
      {state?.ok && <span className="text-xs text-green-700">{t("deals.pushed")}</span>}
      {state?.error && <p className="w-full text-xs text-red-700">{state.error}</p>}
    </form>
  );
}

function GroupManager({ leadFileId, groups, activeGroup, onSelect, total }) {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [state, action, pending] = useActionState(addLeadGroup, {});
  const [renamePending, startRename] = useTransition();
  const [delPending, startDel] = useTransition();

  useEffect(() => { if (state?.ok) setShowAdd(false); }, [state?.ok]);

  function startEdit(g) { setEditingId(g.id); setEditName(g.name); }
  function saveRename(id) {
    if (!editName.trim()) return;
    startRename(async () => { await renameGroup(id, editName.trim(), `/leads/${leadFileId}`); setEditingId(null); });
  }
  const tabCls = (active) =>
    "rounded-full px-3 py-1 text-sm transition-colors " +
    (active ? "bg-[var(--brand)] text-white" : "bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--background)]");

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onSelect("all")} className={tabCls(activeGroup === "all")}>{t("common.all")} ({total})</button>
        {groups.map((g) => (
          <span key={g.id} className="flex items-center gap-1">
            {editingId === g.id ? (
              <span className="flex items-center gap-1">
                <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveRename(g.id); if (e.key === "Escape") setEditingId(null); }}
                  className="w-32 rounded-full border border-[var(--brand)] px-3 py-1 text-sm outline-none" />
                <button type="button" onClick={() => saveRename(g.id)} disabled={renamePending} className="text-xs text-[var(--brand)] hover:underline">{t("common.save")}</button>
                <button type="button" onClick={() => setEditingId(null)} className="text-xs text-[var(--muted)]">✕</button>
              </span>
            ) : (
              <>
                <button type="button" onClick={() => onSelect(g.id)} className={tabCls(activeGroup === g.id)}>{g.name}</button>
                <button type="button" onClick={() => startEdit(g)} className="text-xs text-[var(--muted)] hover:text-[var(--brand)]" title={t("common.edit")}>✎</button>
                <button type="button" disabled={delPending} onClick={() => startDel(() => deleteGroup(g.id, null))} className="text-xs text-[var(--muted)] hover:text-red-600">✕</button>
              </>
            )}
          </span>
        ))}
        <button type="button" onClick={() => onSelect("none")} className={tabCls(activeGroup === "none")}>{t("groups.none")}</button>
        <button type="button" onClick={() => setShowAdd((v) => !v)} className="rounded-full border border-dashed border-[var(--border)] px-3 py-1 text-sm text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]">+ {t("groups.add")}</button>
      </div>
      {showAdd && (
        <form action={action} className="mt-3 flex items-center gap-2">
          <input type="hidden" name="lead_file_id" value={leadFileId} />
          <Input name="name" placeholder={t("groups.addPlaceholder")} className="max-w-xs" />
          <Button type="submit" disabled={pending}>{t("common.add")}</Button>
          <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>{t("common.cancel")}</Button>
        </form>
      )}
    </div>
  );
}
