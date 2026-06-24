"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icons";

export default function DashboardView({ name, stats, followups }) {
  const { t } = useTranslation();

  const cards = [
    { key: "contacts", value: stats.contacts, icon: "contacts", href: "/contacts", helper: "Open people database" },
    { key: "companies", value: stats.companies, icon: "companies", href: "/companies", helper: "Open company database" },
    { key: "events", value: stats.events, icon: "events", href: "/events", helper: "Open event workspace" },
    { key: "leads", value: stats.leads || 0, icon: "deals", href: "/leads", helper: "Open lead files" },
    { key: "sales", value: stats.deals || 0, icon: "deals", href: "/sales", helper: "Open sales pipeline" },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("dashboard.title")}</h1>
          <p className="mt-1 text-[var(--muted)]">{t("dashboard.welcome", { name })}</p>
        </div>
        <Link href="/import" className="rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90">Import Excel</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => {
          const CardIcon = Icon[c.icon] || Icon.dashboard;
          return (
            <Link key={c.key} href={c.href} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-md">
              <div className="flex items-center justify-between text-[var(--muted)]">
                <span className="text-sm capitalize">{c.key}</span>
                <CardIcon />
              </div>
              <p className="mt-2 text-3xl font-semibold">{c.value}</p>
              <p className="mt-2 text-xs text-[var(--muted)] group-hover:text-[var(--brand)]">{c.helper} →</p>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-lg font-semibold">{t("dashboard.upcomingFollowups")}</h2>
        {followups.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--muted)]">{t("dashboard.empty")}</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--border)]">
            {followups.map((f) => (
              <li key={f.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-medium">{f.contact?.full_name}</p>
                  <p className="text-sm text-[var(--muted)]">{f.next_step}</p>
                </div>
                <span className="text-xs text-[var(--muted)]">{f.next_step_due}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
