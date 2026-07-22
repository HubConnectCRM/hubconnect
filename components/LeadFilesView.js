"use client";

import { useActionState, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { saveLeadFile } from "@/app/(app)/leads/actions";
import { combineLeadMetrics, leadRate, LEAD_PROBABILITIES } from "@/lib/leadMetrics";

export default function LeadFilesView({ files, loadError = null, canEdit = true }) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [q, setQ] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const eventOptions = useMemo(() => Array.from(new Map(files.filter((file) => file.linked_event?.id).map((file) => [file.linked_event.id, file.linked_event])).values()).sort((a, b) => a.name.localeCompare(b.name)), [files]);
  const contextFiles = useMemo(() => files.filter((file) => eventFilter === "all" || (eventFilter === "unlinked" ? !file.linked_event_id : file.linked_event_id === eventFilter)), [files, eventFilter]);
  const filtered = useMemo(() => contextFiles.filter((file) => !q.trim() || [file.name, file.description, file.created_by?.full_name, file.linked_event?.name].filter(Boolean).join(" ").toLowerCase().includes(q.trim().toLowerCase())), [contextFiles, q]);
  const performance = useMemo(() => combineLeadMetrics(contextFiles.map((file) => file.performance)), [contextFiles]);
  const eventRows = useMemo(() => {
    const grouped = new Map();
    for (const file of files) {
      const key = file.linked_event_id || "unlinked";
      const label = file.linked_event?.name || t("leadPerformance.unlinked");
      if (!grouped.has(key)) grouped.set(key, { id: key, label, files: [] });
      grouped.get(key).files.push(file);
    }
    return Array.from(grouped.values()).map((row) => ({ ...row, metrics: combineLeadMetrics(row.files.map((file) => file.performance)) })).sort((a, b) => a.label.localeCompare(b.label));
  }, [files, t]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title={t("leads.title")} subtitle={t("leads.subtitle")}>
        {canEdit && <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? t("common.cancel") : t("leads.new")}
        </Button>}
      </PageHeader>

      {!canEdit && <Card className="mb-5 border-blue-400/25 bg-blue-400/[.06] p-4"><p className="text-sm font-semibold text-blue-200">Read-only Leads view</p><p className="mt-1 text-xs text-[var(--muted)]">Events users can review Sales workspaces, but only Sales can change leads or opportunities.</p></Card>}

      {loadError && (
        <Card className="mb-5 border-red-500/30 p-4 text-sm text-red-300">
          Supabase data could not be loaded: {loadError}
        </Card>
      )}

      {showForm && (
        <Card className="mb-6 p-5">
          <LeadFileForm onCancel={() => setShowForm(false)} />
        </Card>
      )}

      <LeadPerformancePanel
        files={contextFiles}
        metrics={performance}
        eventRows={eventRows}
        eventOptions={eventOptions}
        eventFilter={eventFilter}
        onEventFilter={setEventFilter}
        showEventTable={eventFilter === "all"}
      />

      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search")} className="mb-5" />

      {files.length === 0 && !showForm ? (
        <EmptyState>{t("leads.empty")}</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((f) => (
            <a
              key={f.id}
              href={`/leads/${f.id}`}
              className="group block rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--brand)]"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{f.name}</h3>
                <Badge color="brand">
                  {f.contactCount} {t("import.rows")}
                </Badge>
              </div>
              {f.description && (
                <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">{f.description}</p>
              )}
              <p className="mt-2 text-xs text-[var(--muted)]">
                {new Date(f.created_at).toLocaleDateString()}
                {f.created_by?.full_name && ` · ${f.created_by.full_name}`}
              </p>
              {f.linked_event?.name && <p className="mt-2 text-xs font-medium text-[var(--brand)]">{f.linked_event.name}</p>}
              <div className="mt-4 grid grid-cols-4 gap-2 border-t border-white/10 pt-4 text-center"><Mini label={t("web.opportunities")} value={f.dealCount || 0} /><Mini label="T90" value={f.t90Count || 0} /><Mini label="T70" value={f.t70Count || 0} /><Mini label="T50" value={f.t50Count || 0} /></div>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px]"><Badge color="green">{t("leadPerformance.sales")} {f.performance?.outcomes?.won || 0}</Badge><Badge color="red">{t("leadPerformance.failed")} {f.performance?.outcomes?.failed || 0}</Badge><Badge color="amber">{t("leadPerformance.postponed")} {f.performance?.outcomes?.postponed || 0}</Badge></div>
              <p className="mt-4 text-xs font-medium text-[var(--brand)]">{t("common.view")} →</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function LeadPerformancePanel({ files, metrics, eventRows, eventOptions, eventFilter, onEventFilter, showEventTable }) {
  const { t } = useTranslation();
  const total = metrics.total || 0;
  return (
    <Card className="mb-6 overflow-hidden">
      <div className="border-b border-[var(--border)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--brand)]">{t("leadPerformance.eyebrow")}</p><h2 className="mt-1 text-2xl font-semibold">{t("leadPerformance.title")}</h2><p className="mt-1 text-sm text-[var(--muted)]">{t("leadPerformance.subtitle")}</p></div>
          <div className="w-full sm:w-72"><Select value={eventFilter} onChange={(event) => onEventFilter(event.target.value)} aria-label={t("leadPerformance.eventFilter")}><option value="all">{t("leadPerformance.allEvents")}</option>{eventOptions.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}<option value="unlinked">{t("leadPerformance.unlinked")}</option></Select></div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <HeadlineMetric label={t("leadPerformance.files")} value={files.length} />
          <HeadlineMetric label={t("leadPerformance.allLeads")} value={total} />
          <HeadlineMetric label={t("leadPerformance.sales")} value={metrics.outcomes.won} rate={total ? leadRate(metrics.outcomes.won, total) : null} color="green" />
          <HeadlineMetric label={t("leadPerformance.failed")} value={metrics.outcomes.failed} rate={total ? leadRate(metrics.outcomes.failed, total) : null} color="red" />
          <HeadlineMetric label={t("leadPerformance.postponed")} value={metrics.outcomes.postponed} rate={total ? leadRate(metrics.outcomes.postponed, total) : null} color="amber" />
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-3">
        {LEAD_PROBABILITIES.map((probability) => <ProbabilityCard key={probability} probability={probability} bucket={metrics.byProbability[probability]} />)}
      </div>

      {showEventTable && eventRows.length > 0 && <div className="border-t border-[var(--border)] p-5"><h3 className="mb-3 font-semibold">{t("leadPerformance.eventBreakdown")}</h3><div className="overflow-x-auto rounded-2xl border border-[var(--border)]"><table className="w-full min-w-[760px] text-sm"><thead className="bg-[var(--background)] text-left text-[var(--muted)]"><tr><th className="px-4 py-3">{t("events.title")}</th><th className="px-4 py-3">{t("leadPerformance.allLeads")}</th><th className="px-4 py-3">T90</th><th className="px-4 py-3">T70</th><th className="px-4 py-3">T50</th><th className="px-4 py-3">{t("leadPerformance.sales")}</th><th className="px-4 py-3">{t("leadPerformance.failed")}</th><th className="px-4 py-3">{t("leadPerformance.postponed")}</th></tr></thead><tbody>{eventRows.map((row) => <tr key={row.id} className="border-t border-[var(--border)]"><td className="px-4 py-3 font-medium">{row.label}<span className="ml-2 text-xs text-[var(--muted)]">{row.files.length} {t("leadPerformance.filesLower")}</span></td><td className="px-4 py-3">{row.metrics.total}</td>{LEAD_PROBABILITIES.map((probability) => <td key={probability} className="px-4 py-3">{row.metrics.byProbability[probability].total}</td>)}<RateCell value={row.metrics.outcomes.won} total={row.metrics.total} color="text-emerald-300" /><RateCell value={row.metrics.outcomes.failed} total={row.metrics.total} color="text-red-300" /><RateCell value={row.metrics.outcomes.postponed} total={row.metrics.total} color="text-amber-300" /></tr>)}</tbody></table></div></div>}
    </Card>
  );
}

function HeadlineMetric({ label, value, rate, color = "default" }) {
  const colors = { green: "border-emerald-400/20 bg-emerald-400/[.07]", red: "border-red-400/20 bg-red-400/[.07]", amber: "border-amber-400/20 bg-amber-400/[.07]", default: "border-[var(--border)] bg-white/[.03]" };
  return <div className={`rounded-2xl border p-4 ${colors[color]}`}><p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--muted)]">{label}</p><div className="mt-2 flex items-end justify-between gap-2"><strong className="text-2xl">{value}</strong>{rate !== undefined && <span className="text-xs font-semibold">{rate === null ? "—" : `%${rate}`}</span>}</div></div>;
}

function ProbabilityCard({ probability, bucket }) {
  const { t } = useTranslation();
  const total = bucket.total || 0;
  return <div className="rounded-3xl border border-[var(--border)] bg-[var(--background)] p-4"><div className="flex items-start justify-between"><div><p className="text-xs text-[var(--muted)]">{t("leadPerformance.probabilityGroup")}</p><h3 className="mt-1 text-2xl font-semibold">{probability}</h3></div><strong className="rounded-2xl bg-[var(--brand)] px-3 py-2 text-[var(--brand-ink)]">{total}</strong></div><OutcomeBar bucket={bucket} /><div className="mt-4 grid grid-cols-2 gap-2"><OutcomeMini label={t("leadPerformance.sales")} value={bucket.won} total={total} color="text-emerald-300" /><OutcomeMini label={t("leadPerformance.failed")} value={bucket.failed} total={total} color="text-red-300" /><OutcomeMini label={t("leadPerformance.postponed")} value={bucket.postponed} total={total} color="text-amber-300" /><OutcomeMini label={t("leadPerformance.open")} value={bucket.open} total={total} color="text-sky-300" /></div></div>;
}

function OutcomeBar({ bucket }) {
  const total = bucket.total || 0;
  const segments = [["won", "bg-emerald-400"], ["failed", "bg-red-400"], ["postponed", "bg-amber-400"], ["open", "bg-sky-400"]];
  return <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-white/5">{segments.map(([key, color]) => <span key={key} className={color} style={{ width: `${leadRate(bucket[key], total)}%` }} />)}</div>;
}

function OutcomeMini({ label, value, total, color }) {
  return <div className="rounded-2xl bg-white/[.035] p-3"><p className="text-[10px] uppercase tracking-[.1em] text-[var(--muted)]">{label}</p><p className={`mt-1 text-lg font-semibold ${color}`}>{value} <span className="text-xs font-medium text-[var(--muted)]">· {total ? `%${leadRate(value, total)}` : "—"}</span></p></div>;
}

function RateCell({ value, total, color }) {
  return <td className={`px-4 py-3 font-medium ${color}`}>{value} <span className="text-xs text-[var(--muted)]">· {total ? `%${leadRate(value, total)}` : "—"}</span></td>;
}

function Mini({ label, value }) {
  return <span><strong className="block text-sm text-[var(--foreground)]">{value}</strong><span className="text-[10px] text-[var(--muted)]">{label}</span></span>;
}

function LeadFileForm({ file, onCancel }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(saveLeadFile, {});

  return (
    <form action={action} className="space-y-4 max-w-lg">
      {file && <input type="hidden" name="id" value={file.id} />}
      <Field label={t("common.name")}>
        <Input name="name" defaultValue={file?.name || ""} required />
      </Field>
      <Field label={t("leads.description")}>
        <Textarea name="description" defaultValue={file?.description || ""} rows={2} />
      </Field>
      {!file && (
        <Field label={`${t("groups.firstGroup")} (${t("common.optional")})`}>
          <Input name="first_group" placeholder={t("groups.addPlaceholder")} />
        </Field>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : file ? t("common.save") : t("common.create")}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        )}
        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      </div>
    </form>
  );
}
