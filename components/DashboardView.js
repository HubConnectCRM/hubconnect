"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icons";

export default function DashboardView({ name, stats, followups, leadFollowups = [], upcomingEvents = [], recentActivity = [] }) {
  const { t } = useTranslation();

  const cards = [
    { key: t("web.activePipeline"), value: new Intl.NumberFormat(undefined, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(stats.activePipelineValue || 0), icon: "sales", href: "/leads", helper: `${stats.activePipeline} ${t("web.opportunities")}` },
    { key: t("web.wonSales"), value: stats.won, icon: "sales", href: "/sales", helper: t("web.wonSalesHint") },
    { key: t("web.upcomingEvents"), value: upcomingEvents.length, icon: "events", href: "/events", helper: t("web.upcomingEventsHint") },
    { key: t("web.leadFiles"), value: stats.leads || 0, icon: "sales", href: "/leads", helper: t("web.leadFilesHint") },
  ];

  const daysLeft = (date) => Math.max(0, Math.ceil((new Date(`${date}T00:00:00`) - new Date()) / 86400000));

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--brand)]">{t("web.todayWorkspace")}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("web.hello", { name: name?.split(" ")?.[0] || name })}</h1>
          <p className="mt-1 text-[var(--muted)]">{t("web.personalSubtitle")}</p>
        </div>
        <Link href="/import" className="rounded-2xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-ink)] hover:brightness-95">Excel Import</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => {
          const CardIcon = Icon[c.icon] || Icon.dashboard;
          return (
            <Link key={c.key} href={c.href} className="group rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--brand)]">
              <div className="flex items-center justify-between text-[var(--muted)]">
                <span className="text-sm">{c.key}</span>
                <CardIcon />
              </div>
              <p className="mt-2 text-3xl font-semibold">{c.value}</p>
              <p className="mt-2 text-xs text-[var(--muted)] group-hover:text-[var(--brand)]">{c.helper} →</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--brand)]">{t("web.forYou")}</p><h2 className="mt-1 text-lg font-semibold">{t("dashboard.upcomingFollowups")}</h2></div><Link href="/contacts" className="text-xs text-[var(--brand)]">{t("web.viewAll")} →</Link></div>
        {[...followups, ...leadFollowups].length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{t("dashboard.empty")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {[...followups.map((f) => ({ ...f, label: f.contact?.full_name, detail: f.next_step, due: f.next_step_due })), ...leadFollowups.map((f) => ({ ...f, label: f.contact?.company?.name || f.contact?.full_name, detail: `${f.probability} · ${f.next_step || t("web.reconnect")}`, due: f.reconnect_at }))].sort((a,b) => new Date(a.due) - new Date(b.due)).map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium">{f.label}</p>
                  <p className="text-sm text-[var(--muted)]">{f.detail}</p>
                </div>
                <span className="rounded-full bg-[var(--brand)]/10 px-3 py-1 text-xs text-[var(--brand)]">{new Date(f.due).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--brand)]">{t("web.calendar")}</p><h2 className="mt-1 text-lg font-semibold">{t("web.upcomingEvents")}</h2></div><Link href="/events" className="text-xs text-[var(--brand)]">{t("nav.events")} →</Link></div>
        {upcomingEvents.length === 0 ? <p className="mt-4 text-sm text-[var(--muted)]">{t("web.noUpcomingEvents")}</p> : <div className="mt-4 space-y-3">{upcomingEvents.map((event) => <Link key={event.id} href={`/events/${event.id}`} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3 hover:border-[var(--brand)]/40"><span className="flex h-12 w-12 flex-none flex-col items-center justify-center rounded-2xl bg-[var(--brand)] text-[var(--brand-ink)]"><strong className="text-lg leading-none">{daysLeft(event.start_date)}</strong><span className="text-[9px] uppercase">{t("web.days")}</span></span><span className="min-w-0"><strong className="block truncate text-sm">{event.name}</strong><span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{event.location || t("web.locationPending")} · {new Date(event.start_date).toLocaleDateString()}</span></span></Link>)}</div>}
      </div>
      {recentActivity.length > 0 && <div className="mt-5 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 xl:col-span-2"><h2 className="text-lg font-semibold">{t("dashboard.recentActivity")}</h2><div className="mt-3 grid gap-2 md:grid-cols-2">{recentActivity.map((item) => <div key={item.id} className="flex items-center justify-between rounded-2xl bg-white/[0.025] px-4 py-3"><span className="text-sm">{t(`audit.actions.${item.action}`)} · {item.table_name}</span><span className="text-xs text-[var(--muted)]">{new Date(item.changed_at).toLocaleString()}</span></div>)}</div></div>}
      </div>
    </div>
  );
}
