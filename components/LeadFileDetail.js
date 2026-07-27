"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select } from "@/components/ui";
import NewPersonModal from "@/components/NewPersonModal";
import Combobox from "@/components/Combobox";
import DeleteButton from "@/components/DeleteButton";
import { addLeadGroup, createOpportunityFromLeadContact, deleteLeadFile, linkLeadFileToEvent, renameGroup, setLeadPipelineStage, updateLeadPerson } from "@/app/(app)/leads/actions";
import { deleteGroup } from "@/app/(app)/events/actions";
import { deleteDeal, pushDealToEvent, saveDeal, setDealStage } from "@/app/(app)/deals/actions";
import { leadRate, LEAD_PROBABILITIES } from "@/lib/leadMetrics";

const STAGES = ["prospect", "in_progress", "won", "lost"];
const STAGE_COLOR = { prospect: "gray", in_progress: "amber", won: "green", lost: "red" };
const RSVP_COLOR = { yes: "green", no: "red", maybe: "amber" };

export default function LeadFileDetail({ file, deals, leadContacts = [], groups, companies, contacts, events, owners, performance, pipelineEvents = [], canEdit = true }) {
  const { t } = useTranslation();
  const [activeGroup, setActiveGroup] = useState("all");
  const [tab, setTab] = useState("people");
  const [showPerson, setShowPerson] = useState(false);
  const [showDealForm, setShowDealForm] = useState(false);
  const [probability, setProbability] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("");

  const filteredDeals = useMemo(() => (
    deals.filter((d) => {
      if (activeGroup === "none" && d.group_id) return false;
      if (activeGroup !== "all" && activeGroup !== "none" && d.group_id !== activeGroup) return false;
      if (ownerFilter && d.owner_id !== ownerFilter) return false;
      if (probability !== "all" && !new RegExp(`\\b${probability}\\b`, "i").test(d.notes || "")) return false;
      return true;
    })
  ), [deals, activeGroup, ownerFilter, probability]);

  const filteredPeople = useMemo(() => (
    leadContacts.filter((row) => {
      if (activeGroup === "none" && row.group_id) return false;
      if (activeGroup !== "all" && activeGroup !== "none" && row.group_id !== activeGroup) return false;
      if (ownerFilter && (row.owner_id || row.contact?.owner_id) !== ownerFilter) return false;
      if (probability !== "all" && (row.probability || "T50").toUpperCase() !== probability) return false;
      return true;
    })
  ), [leadContacts, activeGroup, ownerFilter, probability]);

  const companyMap = new Map();
  for (const lc of leadContacts) {
    const c = lc.contact?.company;
    if (c?.id || c?.name) companyMap.set(c.id || c.name, c);
  }
  for (const d of deals) {
    const c = d.company || { id: d.company_id || d.company_name, name: d.company_name };
    if (c?.id || c?.name) companyMap.set(c.id || c.name, c);
  }
  const companyRows = Array.from(companyMap.values()).filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-4"><Button variant="ghost" href="/leads">← {t("common.back")}</Button></div>

      <PageHeader title={file.name} subtitle={file.description || "People, companies and sales opportunities inside this lead workspace."}>
        <Button variant="secondary" href={`/api/export/leads?file=${file.id}`}>Excel Export</Button>
        <Button variant="secondary" href={`/cost?leadFile=${file.id}`}>{t("cost.open")}</Button>
        {canEdit && <Button onClick={() => setShowPerson(true)}>+ Add Person</Button>}
        {canEdit && <Button variant="secondary" onClick={() => setShowDealForm((v) => !v)}>{showDealForm ? "Hide opportunity" : "+ Create opportunity"}</Button>}
        {canEdit && <Button variant="secondary" href={`/import?leadFileId=${file.id}&destination=lead_file`}>Import to this file</Button>}
        {canEdit && <DeleteButton action={deleteLeadFile} id={file.id} confirmText={t("leads.deleteConfirm")} />}
      </PageHeader>

      {!canEdit && <Card className="mb-4 border-blue-400/25 bg-blue-400/[.06] p-4"><p className="text-sm font-semibold text-blue-200">Read-only Sales workspace</p><p className="mt-1 text-xs text-[var(--muted)]">You can review every lead, company and won result. Editing remains with the Sales team.</p></Card>}

      {canEdit && <NewPersonModal open={showPerson} onClose={() => setShowPerson(false)} companies={companies} owners={owners} leadFiles={[file]} groups={groups.map((g) => ({ ...g, lead_file_id: file.id }))} defaultLeadFileId={file.id} title={`Add person to ${file.name}`} />}

      <LeadFileEventLink file={file} events={events} canEdit={canEdit} />
      <LeadFilePerformance metrics={performance} />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <button onClick={() => setTab("people")} className="text-left"><Card className={`p-4 ${tab === "people" ? "ring-2 ring-[var(--brand)]" : ""}`}><p className="text-xs text-[var(--muted)]">People</p><p className="mt-1 text-2xl font-semibold">{leadContacts.length}</p></Card></button>
        <button onClick={() => setTab("companies")} className="text-left"><Card className={`p-4 ${tab === "companies" ? "ring-2 ring-[var(--brand)]" : ""}`}><p className="text-xs text-[var(--muted)]">Companies</p><p className="mt-1 text-2xl font-semibold">{companyRows.length}</p></Card></button>
        <button onClick={() => setTab("deals")} className="text-left"><Card className={`p-4 ${tab === "deals" ? "ring-2 ring-[var(--brand)]" : ""}`}><p className="text-xs text-[var(--muted)]">Opportunities</p><p className="mt-1 text-2xl font-semibold">{deals.length}</p></Card></button>
        <button onClick={() => setTab("deals")} className="text-left"><Card className="p-4"><p className="text-xs text-[var(--muted)]">Won / pushed</p><p className="mt-1 text-2xl font-semibold">{deals.filter((d) => d.stage === "won" || d.pushed_event_id).length}</p></Card></button>
      </div>

      {canEdit && showDealForm && <Card className="mb-4 p-5">
        <h2 className="mb-1 text-sm font-semibold text-[var(--muted)]">Create sales opportunity</h2>
        <p className="mb-3 text-xs text-[var(--muted)]">Use this only when a company becomes a real sales opportunity. People can be added separately above.</p>
        <AddDealForm leadFileId={file.id} companies={companies} groups={groups} owners={owners} />
      </Card>}

      {(tab === "people" || tab === "deals") && <Card className="mb-4 p-3"><div className="flex flex-wrap items-center gap-2"><span className="mr-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--muted)]">{t("leadPipeline.probability")}</span>{[["all",t("common.all")],["T90","T90 · "+t("leadPipeline.focus")],["T70","T70 · "+t("leadPipeline.push")],["T50","T50 · "+t("leadPipeline.plan")]].map(([value,label]) => <button key={value} type="button" onClick={() => setProbability(value)} className={"rounded-2xl px-3 py-2 text-sm " + (probability === value ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white/[0.05] text-[var(--muted)]")}>{label}</button>)}<div className="ml-auto w-52"><Select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}><option value="">{t("leadPipeline.allOwners")}</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.full_name || o.email}</option>)}</Select></div></div></Card>}

      <GroupManager leadFileId={file.id} groups={groups} activeGroup={activeGroup} onSelect={setActiveGroup} total={tab === "people" ? leadContacts.length : deals.length} canEdit={canEdit} />

      {tab === "people" && <PeopleTable rows={filteredPeople} leadFileId={file.id} groups={groups} owners={owners} companies={companies} pipelineEvents={pipelineEvents} canEdit={canEdit} />}
      {tab === "companies" && <CompanyGrid companies={companyRows} />}
      {tab === "deals" && (
        <>
          <h2 className="mb-3 text-lg font-semibold">Opportunities ({filteredDeals.length})</h2>
          {filteredDeals.length === 0 ? <EmptyState>No opportunities yet. Add people first, then create an opportunity when sales is real.</EmptyState> : <div className="space-y-3">{filteredDeals.map((d, i) => <DealCard key={d.id} deal={d} leadFileId={file.id} groups={groups} contacts={contacts} events={events} defaultOpen={i === 0 && (d.reps || []).length === 0} canEdit={canEdit} />)}</div>}
        </>
      )}
    </div>
  );
}

function LeadFileEventLink({ file, events, canEdit }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(linkLeadFileToEvent, {});
  if (!canEdit) {
    const linked = events.find((event) => event.id === file.linked_event_id);
    return <Card className="mb-4 p-4"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--muted)]">Linked event</p><p className="mt-2 font-medium">{linked?.name || "Not linked"}</p><Badge color={file.status === "approved" ? "green" : "gray"}>{file.status || "draft"}</Badge></Card>;
  }
  return (
    <Card className="mb-4 p-4">
      <form action={action} className="grid items-end gap-3 md:grid-cols-[1fr_12rem_auto]">
        <input type="hidden" name="lead_file_id" value={file.id} />
        <Field label={t("events.title")}>
          <Select name="linked_event_id" defaultValue={file.linked_event_id || ""}>
            <option value="">{t("common.none")}</option>
            {events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}
          </Select>
        </Field>
        <Field label={t("common.status")}>
          <Select name="status" defaultValue={file.status || "draft"}>
            <option value="draft">Draft</option>
            <option value="ready">Ready</option>
            <option value="approved">Approved</option>
          </Select>
        </Field>
        <Button type="submit" disabled={pending}>{pending ? t("common.saving") : t("common.save")}</Button>
      </form>
      {state?.ok && <p className="mt-2 text-xs text-green-500">{t("common.saved")}</p>}
      {state?.error && <p className="mt-2 text-xs text-red-500">{state.error}</p>}
    </Card>
  );
}

function LeadFilePerformance({ metrics }) {
  const { t } = useTranslation();
  if (!metrics) return null;
  const total = metrics.total || 0;
  const outcomes = [
    ["won", t("leadPerformance.sales"), "text-emerald-300"],
    ["failed", t("leadPerformance.failed"), "text-red-300"],
    ["postponed", t("leadPerformance.postponed"), "text-amber-300"],
  ];

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand)]">{t("leadPerformance.thisFile")}</p>
          <h2 className="mt-1 text-lg font-semibold">{t("leadPerformance.title")}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {outcomes.map(([key, label, color]) => (
            <div key={key} className="rounded-xl bg-white/[.04] px-3 py-2 text-xs">
              <span className="text-[var(--muted)]">{label}</span>{" "}
              <strong className={color}>{metrics.outcomes[key]} · {total ? `%${leadRate(metrics.outcomes[key], total)}` : "—"}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 p-4 md:grid-cols-3">
        {LEAD_PROBABILITIES.map((probability) => {
          const bucket = metrics.byProbability[probability];
          return (
            <div key={probability} className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-3">
              <div className="flex items-center justify-between"><strong>{probability}</strong><span className="text-sm text-[var(--muted)]">{bucket.total}</span></div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                {outcomes.map(([key, label, color]) => (
                  <div key={key}><span className="block truncate text-[10px] text-[var(--muted)]">{label}</span><strong className={color}>{bucket[key]} · {bucket.total ? `%${leadRate(bucket[key], bucket.total)}` : "—"}</strong></div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PeopleTable({ rows, leadFileId, groups, owners, companies, pipelineEvents, canEdit }) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState(null);
  if (!rows.length) return <EmptyState>No people in this lead file yet. Import an Excel file or click Add Person.</EmptyState>;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--background)] text-left text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 font-medium">Person</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">{t("leadPipeline.probability")}</th>
              <th className="px-4 py-3 font-medium">{t("leadPipeline.reconnect")}</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>{rows.map((r) => <LeadPersonRow key={r.id} row={r} leadFileId={leadFileId} groups={groups} owners={owners} companies={companies} pipelineEvents={pipelineEvents.filter((event) => event.lead_id === r.id)} editing={canEdit && editingId === r.id} onEdit={() => setEditingId(r.id)} onClose={() => setEditingId(null)} canEdit={canEdit} />)}</tbody>
        </table>
      </div>
    </Card>
  );
}

function LeadPersonRow({ row, leadFileId, groups, owners, companies, pipelineEvents, editing, onEdit, onClose, canEdit }) {
  const { t } = useTranslation();
  const c = row.contact || {};
  const [editState, editAction, editPending] = useActionState(updateLeadPerson, {});
  const [oppState, oppAction, oppPending] = useActionState(createOpportunityFromLeadContact, {});
  const [companyName, setCompanyName] = useState(c.company?.name || "");
  const [groupId, setGroupId] = useState(row.group_id || "");

  useEffect(() => { if (editState?.ok) onClose(); }, [editState?.ok]);

  const companyOpts = companies.map((co) => ({ value: co.name, label: co.name }));
  const groupOpts = groups.map((g) => ({ value: g.id, label: g.name }));
  const ownerId = c.owner_id || "";
  const probabilityValue = (row.probability || "T50").toUpperCase();
  const [probabilityDraft, setProbabilityDraft] = useState(probabilityValue);
  const statusColor = row.status === "won" ? "green" : ["lost", "failed"].includes(row.status) ? "red" : ["opportunity", "postponed"].includes(row.status) ? "amber" : row.rsvp === "no" ? "red" : row.rsvp === "yes" ? "green" : "gray";
  const [pipelinePending, startPipelineTransition] = useTransition();

  return (
    <>
      <tr className="border-b border-[var(--border)] last:border-0 align-top hover:bg-[var(--background)]">
        <td className="px-4 py-3 font-medium">{c.full_name || "—"}<div className="text-xs text-[var(--muted)]">{c.phone || ""}</div></td>
        <td className="px-4 py-3 text-[var(--muted)]">{c.company?.name || "—"}</td>
        <td className="px-4 py-3 text-[var(--muted)]">{c.job_title || "—"}</td>
        <td className="px-4 py-3 text-[var(--muted)]">{c.email || "—"}</td>
        <td className="px-4 py-3"><Badge color={probabilityValue === "T90" ? "green" : probabilityValue === "T70" ? "amber" : "blue"}>{probabilityValue}</Badge></td>
        <td className="px-4 py-3 text-xs text-[var(--muted)]">{row.reconnect_at ? new Date(row.reconnect_at).toLocaleDateString() : "—"}</td>
        <td className="px-4 py-3"><Badge color={statusColor}>{row.status || row.rsvp || "lead"}</Badge></td>
        <td className="px-4 py-3 text-right">
          {canEdit ? <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={onEdit} className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:border-[var(--brand)]">Edit</button>
            <form action={oppAction}>
              <input type="hidden" name="lead_file_id" value={leadFileId} />
              <input type="hidden" name="contact_id" value={c.id || ""} />
              <input type="hidden" name="company_id" value={c.company?.id || ""} />
              <input type="hidden" name="company_name" value={c.company?.name || companyName || ""} />
              <input type="hidden" name="owner_id" value={ownerId} />
              <input type="hidden" name="rsvp" value={row.rsvp || ""} />
              <input type="hidden" name="stage" value="prospect" />
              <input type="hidden" name="estimated_value" value={row.estimated_value || 0} />
              <button type="submit" disabled={oppPending || !(c.company?.id || c.company?.name || companyName)} className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs hover:border-[var(--brand)]">Opportunity</button>
            </form>
            <form action={oppAction}>
              <input type="hidden" name="lead_file_id" value={leadFileId} />
              <input type="hidden" name="contact_id" value={c.id || ""} />
              <input type="hidden" name="company_id" value={c.company?.id || ""} />
              <input type="hidden" name="company_name" value={c.company?.name || companyName || ""} />
              <input type="hidden" name="owner_id" value={ownerId} />
              <input type="hidden" name="rsvp" value={row.rsvp || "yes"} />
              <input type="hidden" name="stage" value="won" />
              <input type="hidden" name="estimated_value" value={row.estimated_value || 0} />
              <button type="submit" disabled={oppPending || !(c.company?.id || c.company?.name || companyName)} className="rounded-lg bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700">Mark won</button>
            </form>
          </div> : <span className="text-xs text-[var(--muted)]">View only</span>}
          {oppState?.ok && <div className="mt-1 text-xs text-green-700">Sent to Sales ✓</div>}
          {oppState?.error && <div className="mt-1 text-xs text-red-700">{oppState.error}</div>}
        </td>
      </tr>
      {((!editing && probabilityValue === "T90") || (editing && probabilityDraft === "T90")) && (
        <tr className="border-b border-[var(--border)] bg-black/20">
          <td colSpan={8} className="px-4 py-3"><LeadPipeline row={row} events={pipelineEvents} owners={owners} canEdit={canEdit} pending={pipelinePending} onStage={(stage) => startPipelineTransition(() => setLeadPipelineStage(row.id, stage, leadFileId))} /></td>
        </tr>
      )}
      {!editing && probabilityValue === "T70" && canEdit && (
        <tr className="border-b border-[var(--border)] bg-black/20"><td colSpan={8} className="px-4 py-3"><button type="button" onClick={() => { setProbabilityDraft("T90"); onEdit(); }} className="rounded-xl border border-[var(--brand)]/40 px-3 py-2 text-xs font-semibold text-[var(--brand)] hover:bg-[var(--brand)]/10">↑ T90'a Yükselt</button><span className="ml-2 text-xs text-[var(--muted)]">Kaydet ile tamamlanır</span></td></tr>
      )}
      {editing && (
        <tr className="border-b border-[var(--border)] bg-[var(--background)]">
          <td colSpan={8} className="px-4 py-4">
            <form action={editAction} className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <input type="hidden" name="lead_file_id" value={leadFileId} />
              <input type="hidden" name="lead_contact_id" value={row.id} />
              <input type="hidden" name="contact_id" value={c.id || ""} />
              <input type="hidden" name="company_id" value={c.company?.id || ""} />
              <input type="hidden" name="company_name" value={companyName} />
              <input type="hidden" name="group_id" value={groupId} />
              <Field label="Full name"><Input name="full_name" defaultValue={c.full_name || ""} /></Field>
              <Field label="Company"><Combobox options={companyOpts} value={companyName} onChange={setCompanyName} placeholder="Pick or type company" allowCustom /></Field>
              <Field label="Job title"><Input name="job_title" defaultValue={c.job_title || ""} /></Field>
              <Field label="Email"><Input name="email" defaultValue={c.email || ""} /></Field>
              <Field label="Phone"><Input name="phone" defaultValue={c.phone || ""} /></Field>
              <Field label="LinkedIn"><Input name="linkedin" defaultValue={c.linkedin || ""} /></Field>
              <Field label="Owner"><Select name="owner_id" defaultValue={ownerId}><option value="">Keep / me</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.full_name || o.email}</option>)}</Select></Field>
              <Field label="Group"><Combobox options={groupOpts} value={groupId} onChange={setGroupId} placeholder="No group" /></Field>
              <Field label="Lead status"><Select name="status" defaultValue={row.status || "lead"}><option value="lead">Lead</option><option value="opportunity">Opportunity</option><option value="won">{t("leadPerformance.sales")}</option><option value="lost">{t("leadPerformance.failed")}</option><option value="postponed">{t("leadPerformance.postponed")}</option></Select></Field>
              <Field label={t("leadPipeline.probability")}><Select name="probability" value={probabilityDraft} onChange={(event) => setProbabilityDraft(event.target.value)}><option value="T90">T90</option><option value="T70">T70</option><option value="T50">T50</option></Select></Field>
              <Field label={t("leadPipeline.reconnect")}><Input name="reconnect_at" type="datetime-local" defaultValue={row.reconnect_at ? new Date(row.reconnect_at).toISOString().slice(0,16) : ""} /></Field>
              <Field label={t("leadPipeline.nextStep")}><Input name="next_step" defaultValue={row.next_step || ""} /></Field>
              <Field label={t("leadPipeline.estimatedValue")}><Input name="estimated_value" type="number" min="0" step="0.01" defaultValue={row.estimated_value || 0} /></Field>
              <Field label="RSVP"><Select name="rsvp" defaultValue={row.rsvp || ""}><option value="">Unknown</option><option value="yes">Yes</option><option value="maybe">Maybe</option><option value="no">No</option></Select></Field>
              <Field label="Source"><Input name="source" defaultValue={c.source || ""} /></Field>
              <Field label="Lead notes" className="md:col-span-2"><Input name="lead_notes" defaultValue={row.notes || ""} /></Field>
              <Field label="Contact notes" className="md:col-span-2"><Input name="contact_notes" defaultValue={c.notes || ""} /></Field>
              <div className="flex items-end justify-end gap-2 md:col-span-4">
                <Button type="button" variant="secondary" onClick={() => { setProbabilityDraft(probabilityValue); onClose(); }}>Cancel</Button>
                <Button type="submit" disabled={editPending}>{editPending ? "Saving…" : "Save changes"}</Button>
              </div>
              {editState?.error && <p className="text-sm text-red-700 md:col-span-4">{editState.error}</p>}
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

const PIPELINE_STAGE_COPY = {
  tr: ["Başlamadı", "İlk Görüşme", "2. Görüşme", "Fiyat Onaylandı", "Contract Gönderildi", "Ödeme Alındı", "Confirmed"],
  en: ["Not started", "First meeting", "Second meeting", "Price approved", "Contract sent", "Payment received", "Confirmed"],
  it: ["Non iniziata", "Primo incontro", "Secondo incontro", "Prezzo approvato", "Contratto inviato", "Pagamento ricevuto", "Confermato"],
};

function LeadPipeline({ row, events, owners, canEdit, pending, onStage }) {
  const { i18n } = useTranslation();
  const stages = PIPELINE_STAGE_COPY[i18n.language?.slice(0, 2)] || PIPELINE_STAGE_COPY.en;
  const stage = Number(row.pipeline_stage || 0);
  const ownerMap = new Map(owners.map((owner) => [owner.id, owner.full_name || owner.email]));
  return <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><strong className="text-sm">T90 Sales Pipeline</strong><span className="ml-2 text-xs text-[var(--muted)]">%{Math.round((stage / 6) * 100)} · {stages[stage]}</span></div>{events.length > 0 && <details className="text-xs text-[var(--muted)]"><summary className="cursor-pointer text-[var(--brand)]">Timeline · {events.length}</summary><div className="absolute z-20 mt-2 max-h-56 w-72 overflow-auto rounded-2xl border border-[var(--border)] bg-[#171815] p-3 shadow-2xl">{events.map((event) => <p key={event.id} className="border-b border-white/10 py-2 last:border-0"><strong className="text-white">{stages[event.stage] || event.stage}</strong><br />{ownerMap.get(event.changed_by) || "—"} · {new Date(event.created_at).toLocaleString()}</p>)}</div></details>}</div><div className="grid grid-cols-6 gap-1">{stages.slice(1).map((label, index) => { const value = index + 1; const complete = value <= stage; return <button key={label} type="button" disabled={!canEdit || pending} onClick={() => onStage(value)} title={label} className={`h-2 rounded-full transition ${complete ? "bg-[var(--brand)]" : "bg-white/10"}`} />; })}</div><div className="mt-2 grid grid-cols-3 gap-1 text-[10px] text-[var(--muted)] md:grid-cols-6">{stages.slice(1).map((label) => <span key={label} className="truncate" title={label}>{label}</span>)}</div></div>;
}

function CompanyGrid({ companies }) {
  if (!companies.length) return <EmptyState>No companies yet. Import or add people with a company name.</EmptyState>;
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{companies.map((c) => <Card key={c.id || c.name} className="p-4"><p className="font-semibold">{c.name}</p>{c.website && <a href={c.website} target="_blank" className="mt-1 block text-xs text-[var(--brand)] hover:underline">{c.website}</a>}{c.overview && <p className="mt-2 line-clamp-3 text-xs text-[var(--muted)]">{c.overview}</p>}</Card>)}</div>;
}

function AddDealForm({ leadFileId, companies, groups, owners }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(saveDeal, {});
  const [companyName, setCompanyName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [formKey, setFormKey] = useState(0);

  useEffect(() => { if (state?.ok) { setCompanyName(""); setGroupId(""); setFormKey((k) => k + 1); } }, [state?.ok]);

  const companyOpts = companies.map((c) => ({ value: c.name, label: c.name }));
  const groupOpts = groups.map((g) => ({ value: g.id, label: g.name }));

  return (
    <form key={formKey} action={action} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="lead_file_id" value={leadFileId} />
      <input type="hidden" name="company_name" value={companyName} />
      <input type="hidden" name="group_id" value={groupId} />
      <Field label={t("deals.company")} className="lg:col-span-2">
        <Combobox
          name="_company_display"
          options={companyOpts}
          value={companyName}
          onChange={setCompanyName}
          placeholder={t("deals.companyPlaceholder")}
          allowCustom
        />
      </Field>
      <Field label={t("groups.label")}>
        <Combobox name="_group_display" options={groupOpts} value={groupId} onChange={setGroupId} placeholder={t("groups.noGroup")} />
      </Field>
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
      <div className="flex items-end sm:col-span-2 lg:col-span-3">
        <p className="text-xs text-[var(--muted)]">{t("deals.addThenReps")}</p>
      </div>
      <div className="flex items-end justify-end">
        <Button type="submit" disabled={pending || !companyName} className="w-full">{t("deals.addDeal")}</Button>
      </div>
      {state?.error && <p className="text-sm text-red-700 sm:col-span-2 lg:col-span-4">{state.error === "company_required" ? t("deals.companyRequired") : state.error}</p>}
    </form>
  );
}

function DealCard({ deal, leadFileId, groups, contacts, events, defaultOpen = false, canEdit = true }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);
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
            {canEdit ? <StageSelect deal={deal} leadFileId={leadFileId} /> : <Badge color={STAGE_COLOR[deal.stage]}>{t(`deals.stages.${deal.stage}`)}</Badge>}
            {canEdit && <button
              type="button"
              disabled={pending}
              onClick={() => { if (confirm(t("deals.deleteConfirm"))) startTransition(() => deleteDeal(deal.id, leadFileId)); }}
              className="ml-auto text-xs text-red-600 hover:underline"
            >
              {t("deals.delete")}
            </button>}
          </div>

          {/* Representatives */}
          <p className="mb-2 text-sm font-semibold">{t("deals.repsTitle")}</p>
          {canEdit ? <RepsTable reps={reps} leadFileId={leadFileId} /> : <ReadOnlyReps reps={reps} />}
          {canEdit && <AddRepForm dealId={deal.id} leadFileId={leadFileId} contacts={contacts} source="leads" />}

          {/* Push to event */}
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            {canEdit && <PushToEvent deal={deal} leadFileId={leadFileId} events={events} />}
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

function GroupManager({ leadFileId, groups, activeGroup, onSelect, total, canEdit = true }) {
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
            {canEdit && editingId === g.id ? (
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
                {canEdit && <button type="button" onClick={() => startEdit(g)} className="text-xs text-[var(--muted)] hover:text-[var(--brand)]" title={t("common.edit")}>✎</button>}
                {canEdit && <button type="button" disabled={delPending} onClick={() => startDel(() => deleteGroup(g.id, null))} className="text-xs text-[var(--muted)] hover:text-red-600">✕</button>}
              </>
            )}
          </span>
        ))}
        <button type="button" onClick={() => onSelect("none")} className={tabCls(activeGroup === "none")}>{t("groups.none")}</button>
        {canEdit && <button type="button" onClick={() => setShowAdd((v) => !v)} className="rounded-full border border-dashed border-[var(--border)] px-3 py-1 text-sm text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]">+ {t("groups.add")}</button>}
      </div>
      {canEdit && showAdd && (
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
