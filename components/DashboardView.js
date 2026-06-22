"use client";

import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icons";

export default function DashboardView({ name, stats, followups }) {
  const { t } = useTranslation();

  const cards = [
    { key: "contacts", value: stats.contacts, icon: "contacts" },
    { key: "companies", value: stats.companies, icon: "companies" },
    { key: "events", value: stats.events, icon: "events" },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
      <p className="mt-1 text-[var(--muted)]">
        {t("dashboard.welcome", { name })}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => {
          const CardIcon = Icon[c.icon];
          return (
            <div
              key={c.key}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <div className="flex items-center justify-between text-[var(--muted)]">
                <span className="text-sm">{t(`dashboard.total${cap(c.key)}`)}</span>
                <CardIcon />
              </div>
              <p className="mt-2 text-3xl font-semibold">{c.value}</p>
            </div>
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

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
