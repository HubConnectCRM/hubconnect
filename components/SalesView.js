"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import NewPersonModal from "@/components/NewPersonModal";
import Combobox from "@/components/Combobox";
import { AddRepForm, RepsTable } from "@/components/DealReps";
import { pushDealToEvent, saveDeal, setDealStage } from "@/app/(app)/deals/actions";

const STAGES = ["prospect", "in_progress", "won", "lost"];
const STAGE_COLOR = { prospect: "gray", in_progress: "amber", won: "green", lost: "red" };
const RSVP_COLOR = { yes: "green", no: "red", maybe: "amber" };

export default function SalesView({ deals, owners, events, leadFiles, companies, contacts, groups, loadError = null, canEdit = true }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("");
  const [file, setFile] = useState("");
  const [tab, setTab] = useState("won");
  const [period, setPeriod] = useState("year");
  const [referenceDate, setReferenceDate] = useState(() => new Date().toISOString().slice(0, 10));

  const inPeriod = (value) => {
    if (!value) return true;
    const date = new Date(value);
    const ref = new Date(`${referenceDate}T12:00:00`);
    if (period === "day") return date.toDateString() === ref.toDateString();
    if (period === "week") {
      const start = new Date(ref); start.setDate(ref.getDate() - ((ref.getDay() + 6) % 7)); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(start.getDate() + 7);
      return date >= start && date < end;
    }
    if (period === "year") return date.getFullYear() === ref.getFullYear();
    return date.getFullYear() === ref.getFullYear() && date.getMonth() === ref.getMonth();
  };

  const filteredDeals = useMemo(() => {
    const term = q.trim().toLowerCase();
    return deals.filter((d) => {
      if (owner && d.owner_id !== owner) return false;
      if (file && d.lead_file_id !== file) return false;
      if (!inPeriod(d.won_at || d.updated_at || d.created_at)) return false;
      if (!term) return true;
      const company = (d.company?.name || d.company_name || "").toLowerCase();
      const reps = (d.reps || []).map((r) => r.contact?.full_name || "").join(" ").toLowerCase();
      return company.includes(term) || reps.includes(term) || (d.lead_file?.name || "").toLowerCase().includes(term);
    });
  }, [deals, q, owner, file, period, referenceDate]);

  const companyRows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const ids = new Set(filteredDeals.map((d) => d.company?.id).filter(Boolean));
    return companies.filter((c) => ids.has(c.id) && (!term || c.name?.toLowerCase().includes(term)));
  }, [companies, filteredDeals, q]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title={t("sales.title")} subtitle={t("sales.wonSubtitle")}>
        <Button href="/leads">{t("sales.openLeads")}</Button>
        <Button variant="secondary" href="/api/export/sales">Excel Export</Button>
        {canEdit && <Button variant="secondary" href="/import?destination=sales_pipeline">Excel Import</Button>}
      </PageHeader>

      {!canEdit && <Card className="mb-5 border-blue-400/25 bg-blue-400/[.06] p-4"><p className="text-sm font-semibold text-blue-200">Read-only Sales view</p><p className="mt-1 text-xs text-[var(--muted)]">Events users can review won sales and representatives, but only Sales can change the pipeline.</p></Card>}

      {loadError && <Card className="mb-5 border-red-500/30 p-4 text-sm text-red-300">Supabase data could not be loaded: {loadError}</Card>}

      <Card className="mb-5 p-2"><div className="grid grid-cols-4 gap-1">{[["day",t("common.daily")],["week",t("common.weekly")],["month",t("common.monthly")],["year",t("common.yearly")]].map(([value,label]) => <button key={value} type="button" onClick={() => setPeriod(value)} className={"rounded-2xl px-3 py-2.5 text-sm font-medium transition " + (period === value ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "text-[var(--muted)] hover:bg-white/5")}>{label}</button>)}</div></Card>

      <div className="mb-5 grid gap-3 md:grid-cols-3">
        <Field label={t("common.date")}><Input type="date" value={referenceDate} onChange={(e) => setReferenceDate(e.target.value)} /></Field>
        <Field label={t("deals.owner")}><Select value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">{t("common.all")} · {t("common.team")}</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.full_name || o.email}</option>)}</Select></Field>
        <Field label={t("sales.file")}><Select value={file} onChange={(e) => setFile(e.target.value)}><option value="">{t("sales.allFiles")}</option>{leadFiles.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select></Field>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <button onClick={() => setTab("won")} className="text-left"><Card className={`p-5 ${tab === "won" ? "border-[var(--brand)]" : ""}`}><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--muted)]">Won</p><p className="mt-2 text-3xl font-semibold">{filteredDeals.length}</p><p className="mt-1 text-xs text-[var(--brand)]">{t("sales.wonTitle")}</p></Card></button>
        <button onClick={() => setTab("companies")} className="text-left"><Card className={`p-5 ${tab === "companies" ? "border-[var(--brand)]" : ""}`}><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--muted)]">{t("companies.title")}</p><p className="mt-2 text-3xl font-semibold">{new Set(filteredDeals.map((d) => d.company?.id || d.company_name)).size}</p><p className="mt-1 text-xs text-[var(--brand)]">{t("sales.wonTitle")}</p></Card></button>
        <button onClick={() => setTab("people")} className="text-left"><Card className={`p-5 ${tab === "people" ? "border-[var(--brand)]" : ""}`}><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--muted)]">{t("contacts.title")}</p><p className="mt-2 text-3xl font-semibold">{filteredDeals.reduce((n,d) => n + (d.reps?.length || 0), 0)}</p><p className="mt-1 text-xs text-[var(--brand)]">{t("deals.repsTitle")}</p></Card></button>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-48 flex-1"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search")} /></div>
      </div>

      {tab === "people" && <PeopleTable people={Array.from(new Map(filteredDeals.flatMap((d) => (d.reps || []).map((r) => [r.contact?.id, { ...r.contact, company: d.company }])).filter(([id]) => id)).values())} />}
      {tab === "companies" && <CompanyGrid companies={companyRows} />}
      {tab === "won" && (filteredDeals.length === 0 ? <EmptyState>{t("sales.emptyDeals")}</EmptyState> : <div className="space-y-3">{filteredDeals.map((d) => <SalesDealCard key={d.id} deal={d} events={events} contacts={contacts} canEdit={canEdit} />)}</div>)}
    </div>
  );
}

function PeopleTable({ people }) {
  if (!people.length) return <EmptyState>No won people yet. Move a lead opportunity to Won first.</EmptyState>;
  return <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-[var(--border)] bg-[var(--background)] text-left text-[var(--muted)]"><tr><th className="px-4 py-3 font-medium">Person</th><th className="px-4 py-3 font-medium">Company</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">Email</th></tr></thead><tbody>{people.map((p) => <tr key={p.id} className="border-b border-[var(--border)] last:border-0"><td className="px-4 py-3 font-medium">{p.full_name || "—"}</td><td className="px-4 py-3 text-[var(--muted)]">{p.company?.name || "—"}</td><td className="px-4 py-3 text-[var(--muted)]">{p.job_title || "—"}</td><td className="px-4 py-3 text-[var(--muted)]">{p.email || "—"}</td></tr>)}</tbody></table></div></Card>;
}

function CompanyGrid({ companies }) {
  if (!companies.length) return <EmptyState>No won companies yet.</EmptyState>;
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{companies.map((c) => <Card key={c.id} className="p-4"><p className="font-semibold">{c.name}</p>{c.website && <a href={c.website} target="_blank" className="mt-1 block text-xs text-[var(--brand)] hover:underline">{c.website}</a>}{c.overview && <p className="mt-2 line-clamp-3 text-xs text-[var(--muted)]">{c.overview}</p>}</Card>)}</div>;
}

function AddDealForm({ companies, leadFiles, groups, owners }) {
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
    <form key={formKey} action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="company_name" value={companyName} />
      <input type="hidden" name="lead_file_id" value={isExistingFile ? fileValue : ""} />
      <input type="hidden" name="lead_file_name" value={isExistingFile ? "" : fileValue} />
      <input type="hidden" name="group_id" value={groupId} />
      <Field label={t("deals.company")} className="lg:col-span-2">
        <Combobox name="_company_display" options={companyOpts} value={companyName} onChange={setCompanyName} placeholder={t("deals.companyPlaceholder")} allowCustom />
      </Field>
      <Field label={t("sales.fileOrNew")} className="lg:col-span-2">
        <Combobox name="_file_display" options={fileOpts} value={fileValue} onChange={(v) => { setFileValue(v); setGroupId(""); }} placeholder={t("sales.pickOrNewFile")} allowCustom />
      </Field>
      {groupOpts.length > 0 && (
        <Field label={t("groups.label")}>
          <Combobox name="_group_display" options={groupOpts} value={groupId} onChange={setGroupId} placeholder={t("groups.noGroup")} />
        </Field>
      )}
      <Field label={t("deals.owner")}>
        <Select name="owner_id" defaultValue="">
          <option value="">{t("deals.me")}</option>
          {owners.map((o) => <option key={o.id} value={o.id}>{o.full_name || o.email}</option>)}
        </Select>
      </Field>
      <Field label={t("deals.stage")}>
        <Select name="stage" defaultValue="prospect">
          {STAGES.map((s) => <option key={s} value={s}>{t(`deals.stages.${s}`)}</option>)}
        </Select>
      </Field>
      <div className="flex items-end">
        <Button type="submit" disabled={pending || !companyName || !fileValue} className="w-full">{t("deals.addDeal")}</Button>
      </div>
      <p className="text-xs text-[var(--muted)] sm:col-span-2 lg:col-span-4">{t("deals.addThenReps")}</p>
      {state?.error && (
        <p className="text-sm text-red-700 sm:col-span-2 lg:col-span-4">
          {state.error === "company_required" ? t("deals.companyRequired")
            : state.error === "file_required" ? t("sales.fileRequired")
            : state.error}
        </p>
      )}
    </form>
  );
}

function SalesDealCard({ deal, events, contacts, defaultOpen = false, canEdit = true }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
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
            {canEdit && !deal.synthetic && <select
              value={deal.stage}
              disabled={stagePending}
              onChange={(e) => startStage(() => setDealStage(deal.id, e.target.value, deal.lead_file_id))}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm outline-none focus:border-[var(--brand)]"
            >
              {STAGES.map((s) => <option key={s} value={s}>{t(`deals.stages.${s}`)}</option>)}
            </select>}
            {deal.lead_file && (
              <a href={`/leads/${deal.lead_file.id}`} className="ml-auto text-xs text-[var(--brand)] hover:underline">{t("deals.editInLeads")} →</a>
            )}
          </div>

          {/* Editable reps (sales can add reps / create contacts here) */}
          <p className="mb-2 text-sm font-semibold">{t("deals.repsTitle")}</p>
          {canEdit ? <RepsTable reps={reps} leadFileId={deal.lead_file_id} /> : <ReadOnlyReps reps={reps} />}
          {canEdit && !deal.synthetic && <AddRepForm dealId={deal.id} leadFileId={deal.lead_file_id} contacts={contacts} source="sales" />}

          <div className="mt-4 border-t border-[var(--border)] pt-4">
            {canEdit && !deal.synthetic && <PushToEvent deal={deal} events={events} />}
          </div>
        </div>
      )}
    </Card>
  );
}

function ReadOnlyReps({ reps }) {
  if (!reps.length) return <p className="text-xs text-[var(--muted)]">No representatives.</p>;
  return <div className="divide-y divide-white/10 rounded-2xl border border-white/10">{reps.map((rep) => <div key={rep.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span><strong>{rep.contact?.full_name || "—"}</strong><span className="ml-2 text-xs text-[var(--muted)]">{rep.contact?.job_title || rep.contact?.email || ""}</span></span>{rep.rsvp && <Badge color={RSVP_COLOR[rep.rsvp] || "gray"}>{rep.rsvp}</Badge>}</div>)}</div>;
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
