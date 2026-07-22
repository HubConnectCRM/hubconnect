"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { leadOutcome, leadRate, LEAD_PROBABILITIES } from "@/lib/leadMetrics";

const PERIODS = ["day", "week", "month", "year"];

function periodBounds(period, anchor) {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  if (period === "week") start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (period === "month") start.setDate(1);
  if (period === "year") { start.setMonth(0); start.setDate(1); }
  const end = new Date(start);
  if (period === "day") end.setDate(end.getDate() + 1);
  if (period === "week") end.setDate(end.getDate() + 7);
  if (period === "month") end.setMonth(end.getMonth() + 1);
  if (period === "year") end.setFullYear(end.getFullYear() + 1);
  return { start, end };
}

function shiftAnchor(anchor, period, direction) {
  const next = new Date(anchor);
  if (period === "day") next.setDate(next.getDate() + direction);
  if (period === "week") next.setDate(next.getDate() + direction * 7);
  if (period === "month") next.setMonth(next.getMonth() + direction);
  if (period === "year") next.setFullYear(next.getFullYear() + direction);
  return next;
}

function inRange(row, start, end, field = "created_at") {
  const date = new Date(row[field] || row.created_at);
  return date >= start && date < end;
}

export default function PerformanceView({ leads, deals }) {
  const { t, i18n } = useTranslation();
  const [period, setPeriod] = useState("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const { start, end } = useMemo(() => periodBounds(period, anchor), [period, anchor]);
  const periodLeads = useMemo(() => leads.filter((row) => inRange(row, start, end, "activity_at")), [leads, start, end]);
  const periodDeals = useMemo(() => deals.filter((row) => inRange(row, start, end)), [deals, start, end]);

  const leadStats = useMemo(() => {
    const outcomes = { won: 0, failed: 0, postponed: 0, open: 0 };
    const buckets = Object.fromEntries(LEAD_PROBABILITIES.map((key) => [key, { total: 0, won: 0, failed: 0, postponed: 0, open: 0 }]));
    for (const lead of periodLeads) {
      const probability = LEAD_PROBABILITIES.includes(String(lead.probability).toUpperCase()) ? String(lead.probability).toUpperCase() : "T50";
      const outcome = leadOutcome(lead);
      outcomes[outcome] += 1;
      buckets[probability].total += 1;
      buckets[probability][outcome] += 1;
    }
    return { outcomes, buckets };
  }, [periodLeads]);

  const dealStats = useMemo(() => {
    const won = periodDeals.filter((deal) => deal.stage === "won" || deal.po_won).length;
    const lost = periodDeals.filter((deal) => ["lost", "failed", "closed_lost"].includes(deal.stage)).length;
    return { won, lost, active: Math.max(0, periodDeals.length - won - lost) };
  }, [periodDeals]);

  const locale = i18n.language?.startsWith("tr") ? "tr-TR" : i18n.language?.startsWith("it") ? "it-IT" : "en-GB";
  const label = period === "day"
    ? start.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
    : period === "year"
    ? start.toLocaleDateString(locale, { year: "numeric" })
    : period === "month"
      ? start.toLocaleDateString(locale, { month: "long", year: "numeric" })
      : `${start.toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${new Date(end.getTime() - 1).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title={t("performance.title")} subtitle={t("performance.subtitle")}>
        <Button href="/contact-center" variant="secondary">HQ</Button>
      </PageHeader>

      <Card className="mb-5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((value) => <button key={value} type="button" onClick={() => setPeriod(value)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${period === value ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "text-[var(--muted)] hover:bg-white/5"}`}>{t(`performance.${value}`)}</button>)}
          <div className="ml-auto flex items-center gap-2"><Button type="button" variant="secondary" onClick={() => setAnchor((date) => shiftAnchor(date, period, -1))}>‹</Button><label title={t("common.date")} className="relative"><strong className="block min-w-40 cursor-pointer rounded-xl border border-[var(--border)] px-3 py-2 text-center text-sm">{label} · ◫</strong><Input type="date" value={new Date(anchor.getTime() - anchor.getTimezoneOffset() * 60000).toISOString().slice(0, 10)} onChange={(event) => { if (event.target.value) setAnchor(new Date(`${event.target.value}T12:00:00`)); }} className="absolute inset-0 cursor-pointer opacity-0" /></label><Button type="button" variant="secondary" onClick={() => setAnchor((date) => shiftAnchor(date, period, 1))}>›</Button></div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--border)] p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--brand)]">T90 · T70 · T50</p><h2 className="mt-1 text-xl font-semibold">{t("performance.leadConversion")}</h2></div><Badge color="brand">{periodLeads.length} {t("performance.total")}</Badge></div></div>
          {periodLeads.length === 0 ? <div className="p-5"><EmptyState>{t("performance.noData")}</EmptyState></div> : <div className="grid gap-3 p-5 sm:grid-cols-3">{LEAD_PROBABILITIES.map((probability) => <Bucket key={probability} probability={probability} data={leadStats.buckets[probability]} t={t} />)}</div>}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--border)] p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--brand)]">DEALS</p><h2 className="mt-1 text-xl font-semibold">{t("performance.dealPerformance")}</h2></div><Badge color="brand">{periodDeals.length} {t("performance.total")}</Badge></div></div>
          {periodDeals.length === 0 ? <div className="p-5"><EmptyState>{t("performance.noData")}</EmptyState></div> : <div className="grid gap-3 p-5 sm:grid-cols-3">
            <Metric label={t("performance.won")} value={dealStats.won} total={periodDeals.length} color="text-emerald-300" />
            <Metric label={t("performance.lost")} value={dealStats.lost} total={periodDeals.length} color="text-red-300" />
            <Metric label={t("performance.active")} value={dealStats.active} total={periodDeals.length} color="text-[var(--brand)]" />
          </div>}
        </Card>
      </div>
    </div>
  );
}

function Bucket({ probability, data, t }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-black/25 p-4"><div className="flex items-center justify-between"><strong className="text-lg">{probability}</strong><Badge color={probability === "T90" ? "green" : probability === "T70" ? "amber" : "blue"}>{data.total}</Badge></div><div className="mt-4 space-y-2"><Mini label={t("performance.won")} value={data.won} total={data.total} /><Mini label={t("performance.lost")} value={data.failed} total={data.total} /><Mini label={t("performance.postponed")} value={data.postponed} total={data.total} /><Mini label={t("performance.active")} value={data.open} total={data.total} /></div></div>;
}

function Mini({ label, value, total }) {
  return <div><div className="mb-1 flex justify-between text-xs"><span className="text-[var(--muted)]">{label}</span><strong>{value} · {total ? `%${leadRate(value, total)}` : "—"}</strong></div><div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${leadRate(value, total)}%` }} /></div></div>;
}

function Metric({ label, value, total, color }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-black/25 p-5"><p className="text-sm text-[var(--muted)]">{label}</p><p className={`mt-2 text-4xl font-semibold ${color}`}>{total ? `%${leadRate(value, total)}` : "—"}</p><p className="mt-2 text-xs text-[var(--muted)]">{value} / {total}</p></div>;
}
