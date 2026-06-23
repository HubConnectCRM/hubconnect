"use client";

import { useMemo, useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useActionState } from "react";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import Combobox from "@/components/Combobox";
import { pushDealToEvent, setDealStage } from "@/app/(app)/deals/actions";

const STAGES = ["prospect", "in_progress", "won", "lost"];
const STAGE_COLOR = { prospect: "gray", in_progress: "amber", won: "green", lost: "red" };
const RSVP_COLOR = { yes: "green", no: "red", maybe: "amber" };

export default function SalesView({ deals, owners, events, leadFiles }) {
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
          {filtered.map((d) => <SalesDealCard key={d.id} deal={d} events={events} />)}
        </div>
      )}
    </div>
  );
}

function SalesDealCard({ deal, events }) {
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

          {reps.length > 0 ? (
            <div className="mb-4 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t("deals.rep")}</th>
                    <th className="px-3 py-2 font-medium">{t("common.email")}</th>
                    <th className="px-3 py-2 font-medium">{t("common.phone")}</th>
                    <th className="px-3 py-2 font-medium">{t("rsvp.label")}</th>
                  </tr>
                </thead>
                <tbody>
                  {reps.map((r) => {
                    const c = r.contact || {};
                    return (
                      <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                        <td className="px-3 py-2 font-medium">
                          <a href={`/contacts/${c.id}`} className="hover:underline">{c.full_name || "—"}</a>
                          {c.job_title && <span className="block text-xs text-[var(--muted)]">{c.job_title}</span>}
                        </td>
                        <td className="px-3 py-2 text-[var(--muted)]">{c.email || "—"}</td>
                        <td className="px-3 py-2 text-[var(--muted)]">{c.phone || "—"}</td>
                        <td className="px-3 py-2">
                          {r.rsvp ? <Badge color={RSVP_COLOR[r.rsvp]}>{t(`rsvp.${r.rsvp}`)}</Badge> : <span className="text-xs text-[var(--muted)]">{t("rsvp.none")}</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mb-4 text-sm text-[var(--muted)]">{t("deals.noReps")}</p>
          )}

          <div className="border-t border-[var(--border)] pt-4">
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
