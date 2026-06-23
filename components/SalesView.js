"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import Combobox from "@/components/Combobox";
import { AddRepForm, NewRepFields, RepsTable } from "@/components/DealReps";
import { pushDealToEvent, saveDeal, setDealStage } from "@/app/(app)/deals/actions";

const STAGES = ["prospect", "in_progress", "won", "lost"];
const STAGE_COLOR = { prospect: "gray", in_progress: "amber", won: "green", lost: "red" };
const RSVP_COLOR = { yes: "green", no: "red", maybe: "amber" };

export default function SalesView({ deals, owners, events, leadFiles, companies, contacts, groups }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("");
  const [stage, setStage] = useState("");
  const [file, setFile] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return deals.filter((d) => {
      if (owner && d.owner_id !== owner) return false;
      if (stage && d.stage !== stage) return false;
      if (file && d.lead_file_id !== file) return false;
      if (!term) return true;
      const company = (d.company?.name || d.company_name || "").toLowerCase();
      const reps = (d.reps || []).map((r) => r.contact?.full_name || "").join(" ").toLowerCase();
      return company.includes(term) || reps.includes(term) || (d.lead_file?.name || "").toLowerCase().includes(term);
    });
  }, [deals, q, owner, stage, file]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("sales.title")} subtitle={t("sales.subtitleDeals")} />

      {/* Add deal (also lets sales create a lead file + contacts from here) */}
      <Card className="mb-4 p-5">
        <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">{t("deals.add")}</h2>
        <AddDealForm companies={companies} leadFiles={leadFiles} groups={groups} owners={owners} contacts={contacts} />
      </Card>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-48 flex-1">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search")} />
        </div>
        <div className="w-44">
          <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">{t("contacts.allOwners")}</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.full_name || o.email}</option>)}
          </Select>
        </div>
        <div className="w-40">
          <Select value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">{t("deals.allStages")}</option>
            {STAGES.map((s) => <option key={s} value={s}>{t(`deals.stages.${s}`)}</option>)}
          </Select>
        </div>
        <div className="w-48">
          <Select value={file} onChange={(e) => setFile(e.target.value)}>
            <option value="">{t("sales.allFiles")}</option>
            {leadFiles.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </Select>
        </div>
      </div>

      <p className="mb-2 text-sm text-[var(--muted)]">{filtered.length} {t("deals.title")}</p>

      {filtered.length === 0 ? (
        <EmptyState>{q || owner || stage || file ? t("common.noResults") : t("sales.emptyDeals")}</EmptyState>
      ) : (
        <div className="space-y-3">
          {filtered.map((d) => <SalesDealCard key={d.id} deal={d} events={events} contacts={contacts} />)}
        </div>
      )}
    </div>
  );
}

function AddDealForm({ companies, leadFiles, groups, owners, contacts }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(saveDeal, {});
  const [companyName, setCompanyName] = useState("");
  const [fileValue, setFileValue] = useState("");
  const [groupId, setGroupId] = useState("");
  const [formKey, setFormKey] = useState(0);

  useEffect(() => { if (state?.ok) { setCompanyName(""); setFileValue(""); setGroupId(""); setFormKey((k) => k + 1); } }, [state?.ok]);

  const companyOpts = companies.map((c) => ({ value: c.name, label: c.name }));
  const fileOpts = leadFiles.map((f) => ({ value: f.id, label: f.name }));
  const isExistingFile = leadFiles.some((f) => f.id === fileValue);
  const groupOpts = isExistingFile
    ? groups.filter((g) => g.lead_file_id === fileValue).map((g) => ({ value: g.id, label: g.name }))
    : [];

  return (
    <form key={formKey} action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="company_name" value={companyName} />
      <input type="hidden" name="lead_file_id" value={isExistingFile ? fileValue : ""} />
      <input type="hidden" name="lead_file_name" value={isExistingFile ? "" : fileValue} />
      <input type="hidden" name="group_id" value={groupId} />
      <div className="min-w-52 flex-1">
        <Field label={t("deals.company")}>
          <Combobox name="_company_display" options={companyOpts} value={companyName} onChange={setCompanyName} placeholder={t("deals.companyPlaceholder")} allowCustom />
        </Field>
      </div>
      <div className="w-52">
        <Field label={t("sales.fileOrNew")}>
          <Combobox name="_file_display" options={fileOpts} value={fileValue} onChange={(v) => { setFileValue(v); setGroupId(""); }} placeholder={t("sales.pickOrNewFile")} allowCustom />
        </Field>
      </div>
      {groupOpts.length > 0 && (
        <div className="w-40">
          <Field label={t("groups.label")}>
            <Combobox name="_group_display" options={groupOpts} value={groupId} onChange={setGroupId} placeholder={t("groups.noGroup")} />
          </Field>
        </div>
      )}
      <div className="w-40">
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
      <div className="mt-1 w-full rounded-lg border border-dashed border-[var(--border)] p-3">
        <NewRepFields contacts={contacts} />
      </div>
      <Button type="submit" disabled={pending || !companyName || !fileValue}>{t("common.add")}</Button>
      {state?.error && (
        <p className="w-full text-sm text-red-700">
          {state.error === "company_required" ? t("deals.companyRequired")
            : state.error === "file_required" ? t("sales.fileRequired")
            : state.error}
        </p>
      )}
    </form>
  );
}

function SalesDealCard({ deal, events, contacts }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [stagePending, startStage] = useTransition();
  const reps = deal.reps || [];
  const companyLabel = deal.company?.name || deal.company_name || "—";

  const yesCount = reps.filter((r) => r.rsvp === "yes").length;
  const noCount = reps.filter((r) => r.rsvp === "no").length;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex flex-1 items-center gap-3 text-left">
          <span className="text-[var(--muted)]">{open ? "▾" : "▸"}</span>
          <span className="font-semibold">{companyLabel}</span>
          {deal.group?.name && <Badge color="purple">{deal.group.name}</Badge>}
          <Badge color={STAGE_COLOR[deal.stage]}>{t(`deals.stages.${deal.stage}`)}</Badge>
          <span className="text-sm text-[var(--muted)]">
            {reps.length} {t("deals.reps")}
            {yesCount > 0 && <span className="ml-1 text-green-700">· {yesCount} {t("rsvp.yes")}</span>}
            {noCount > 0 && <span className="ml-1 text-red-700">· {noCount} {t("rsvp.no")}</span>}
          </span>
        </button>
        {deal.lead_file && (
          <a href={`/leads/${deal.lead_file.id}`} className="text-xs text-[var(--brand)] hover:underline">{deal.lead_file.name}</a>
        )}
        {deal.pushed_event_id && <Badge color="blue">{t("deals.pushedTo")}: {deal.pushed_event?.name || "—"}</Badge>}
        <span className="text-xs text-[var(--muted)]">{deal.owner?.full_name || deal.owner?.email || ""}</span>
      </div>

      {open && (
        <div className="border-t border-[var(--border)] bg-[var(--background)] p-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="text-xs text-[var(--muted)]">{t("deals.stage")}:</span>
            <select
              value={deal.stage}
              disabled={stagePending}
              onChange={(e) => startStage(() => setDealStage(deal.id, e.target.value, deal.lead_file_id))}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm outline-none focus:border-[var(--brand)]"
            >
              {STAGES.map((s) => <option key={s} value={s}>{t(`deals.stages.${s}`)}</option>)}
            </select>
            {deal.lead_file && (
              <a href={`/leads/${deal.lead_file.id}`} className="ml-auto text-xs text-[var(--brand)] hover:underline">{t("deals.editInLeads")} →</a>
            )}
          </div>

          {/* Editable reps (sales can add reps / create contacts here) */}
          <RepsTable reps={reps} leadFileId={deal.lead_file_id} />
          <AddRepForm dealId={deal.id} leadFileId={deal.lead_file_id} contacts={contacts} />

          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <PushToEvent deal={deal} events={events} />
          </div>
        </div>
      )}
    </Card>
  );
}

function PushToEvent({ deal, events }) {
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
      <input type="hidden" name="lead_file_id" value={deal.lead_file_id || ""} />
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
