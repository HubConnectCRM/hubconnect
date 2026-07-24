"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icons";

export default function EventsDashboardView({ name, stats, upcomingEvents = [], pendingSponsors = [] }) {
  const { t } = useTranslation();

  const cards = [
    { key: t("web.upcomingEvents"), value: upcomingEvents.length, icon: "events", href: "/events", helper: t("web.upcomingEventsHint") },
    { key: t("web.totalEvents"), value: stats.events, icon: "events", href: "/events", helper: t("web.totalEventsHint") },
    { key: t("web.confirmedUpcoming"), value: stats.confirmedUpcoming, icon: "contacts", href: "/accreditation", helper: t("web.confirmedUpcomingHint") },
    { key: t("web.pendingSponsors"), value: pendingSponsors.length, icon: "sales", href: "/accreditation", helper: t("web.pendingSponsorsHint") },
  ];

  const daysLeft = (date) => Math.max(0, Math.ceil((new Date(`${date}T00:00:00`) - new Date()) / 86400000));

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--brand)]">{t("web.todayWorkspace")}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{t("web.hello", { name: name?.split(" ")?.[0] || name })}</h1>
          <p className="mt-1 text-[var(--muted)]">{t("web.eventsSubtitle")}</p>
        </div>
        <Link href="/events/new" className="rounded-2xl bg-[var(--brand)] px-4 py-2.5 text-sm font-semibold text-[var(--brand-ink)] hover:brightness-95">{t("events.newEvent")}</Link>
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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--brand)]">{t("web.forYou")}</p>
              <h2 className="mt-1 text-lg font-semibold">{t("web.pendingSponsors")}</h2>
            </div>
            <Link href="/accreditation" className="text-xs text-[var(--brand)]">{t("web.viewAll")} →</Link>
          </div>
          {pendingSponsors.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">{t("web.noPendingSponsors")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {pendingSponsors.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.contact?.full_name}{row.contact?.company?.name ? ` · ${row.contact.company.name}` : ""}</p>
                    <p className="truncate text-sm text-[var(--muted)]">{row.event?.name}</p>
                  </div>
                  <Link href={`/accreditation?event=${row.event_id}`} className="flex-none rounded-full bg-[var(--brand)]/10 px-3 py-1 text-xs text-[var(--brand)]">{t("web.review")} →</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--brand)]">{t("web.calendar")}</p>
              <h2 className="mt-1 text-lg font-semibold">{t("web.upcomingEvents")}</h2>
            </div>
            <Link href="/events" className="text-xs text-[var(--brand)]">{t("nav.events")} →</Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="mt-4 text-sm text-[var(--muted)]">{t("web.noUpcomingEvents")}</p>
          ) : (
            <div className="mt-4 space-y-3">
              {upcomingEvents.map((event) => (
                <Link key={event.id} href={`/events/${event.id}`} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3 hover:border-[var(--brand)]/40">
                  <span className="flex h-12 w-12 flex-none flex-col items-center justify-center rounded-2xl bg-[var(--brand)] text-[var(--brand-ink)]">
                    <strong className="text-lg leading-none">{daysLeft(event.start_date)}</strong>
                    <span className="text-[9px] uppercase">{t("web.days")}</span>
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-sm">{event.name}</strong>
                    <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{event.location || t("web.locationPending")} · {new Date(event.start_date).toLocaleDateString()}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
