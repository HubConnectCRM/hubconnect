"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import Combobox from "@/components/Combobox";
import { Badge, Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";

const COPY = {
  en: { jump: "Search and select an event", today: "Today", upcoming: "Upcoming", past: "Past", cancelled: "Cancelled", all: "All events", daysLeft: "days left", daysAgo: "days ago", eventDay: "EVENT DAY", openWorkspace: "Open event workspace", openAccreditation: "Open accreditation", confirmed: "Confirmed by Events team", waiting: "Waiting list by Events team", attended: "Event day attended", notAttended: "Event day not attended", search: "Search event, city, venue or status…", noResults: "No events match these filters.", registrations: "registrations" },
  tr: { jump: "Event ara ve seç", today: "Bugün", upcoming: "Yaklaşan", past: "Geçmiş", cancelled: "İptal", all: "Tüm eventler", daysLeft: "gün kaldı", daysAgo: "gün önce", eventDay: "EVENT GÜNÜ", openWorkspace: "Event çalışma alanını aç", openAccreditation: "Accreditation aç", confirmed: "Events ekibi tarafından confirmed", waiting: "Events ekibi waiting list", attended: "Etkinlik günü geldi", notAttended: "Etkinlik günü gelmedi", search: "Event, şehir, mekan veya durum ara…", noResults: "Bu filtrelere uyan event yok.", registrations: "kayıt" },
  it: { jump: "Cerca e seleziona un evento", today: "Oggi", upcoming: "Prossimi", past: "Passati", cancelled: "Annullati", all: "Tutti gli eventi", daysLeft: "giorni mancanti", daysAgo: "giorni fa", eventDay: "GIORNO EVENTO", openWorkspace: "Apri workspace evento", openAccreditation: "Apri accreditamento", confirmed: "Confermato dal team Events", waiting: "Waiting list del team Events", attended: "Presenti il giorno evento", notAttended: "Assenti il giorno evento", search: "Cerca evento, città, venue o stato…", noResults: "Nessun evento corrisponde ai filtri.", registrations: "registrazioni" },
};

function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function phase(event, today) {
  if (event.status === "cancelled") return "cancelled";
  if (event.startDate && event.startDate <= today && (event.endDate || event.startDate) >= today) return "today";
  if (!event.startDate || event.startDate > today) return "upcoming";
  return "past";
}

function timing(event, today, copy) {
  const eventPhase = phase(event, today);
  if (eventPhase === "today") return { value: copy.today, label: copy.eventDay, live: true };
  if (!event.startDate) return { value: "—", label: "", live: false };
  const days = Math.round((new Date(`${event.startDate}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000);
  return { value: Math.abs(days), label: days >= 0 ? copy.daysLeft : copy.daysAgo, live: false };
}

export default function EventsList({ events, canManage = false }) {
  const { t, i18n } = useTranslation();
  const copy = COPY[i18n.language?.slice(0, 2)] || COPY.en;
  const today = localDateKey();
  const liveEvent = events.find((event) => phase(event, today) === "today");
  const nextEvent = events.filter((event) => phase(event, today) === "upcoming").sort((a, b) => String(a.startDate || "9999-12-31").localeCompare(String(b.startDate || "9999-12-31")))[0];
  const [selectedId, setSelectedId] = useState(liveEvent?.id || nextEvent?.id || events[0]?.id || "");
  const [scope, setScope] = useState(liveEvent ? "today" : "upcoming");
  const [query, setQuery] = useState("");
  const selected = events.find((event) => event.id === selectedId) || events[0] || null;
  const selectedTiming = selected ? timing(selected, today, copy) : null;
  const eventOptions = useMemo(() => events.map((event) => {
    const eventPhase = phase(event, today);
    const prefix = eventPhase === "today" ? `${copy.today} · ` : "";
    return { value: event.id, label: `${prefix}${event.name} · ${event.startDate || "—"}${event.location ? ` · ${event.location}` : ""}` };
  }), [events, today, copy]);
  const counts = useMemo(() => ({
    today: events.filter((event) => phase(event, today) === "today").length,
    upcoming: events.filter((event) => phase(event, today) === "upcoming").length,
    past: events.filter((event) => phase(event, today) === "past").length,
    cancelled: events.filter((event) => phase(event, today) === "cancelled").length,
    all: events.length,
  }), [events, today]);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return events.filter((event) => {
      if (scope !== "all" && phase(event, today) !== scope) return false;
      return !term || [event.name, event.location, event.venueName, event.status, event.startDate].filter(Boolean).join(" ").toLowerCase().includes(term);
    }).sort((a, b) => scope === "past" ? String(b.startDate || "").localeCompare(String(a.startDate || "")) : String(a.startDate || "9999-12-31").localeCompare(String(b.startDate || "9999-12-31")));
  }, [events, scope, query, today]);

  return <div className="mx-auto max-w-[1500px]">
    <PageHeader title={t("events.title")} subtitle={t("events.registrations")}>
      {canManage && <Button href="/events/new"><Icon.events width={16} height={16} />{t("events.new")}</Button>}
    </PageHeader>

    {events.length === 0 ? <EmptyState>{t("events.empty")}</EmptyState> : <>
      <Card className="mb-4 overflow-visible border-[var(--brand)]/25 p-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(300px,500px)_1fr] xl:items-end">
          <div><p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--muted)]">{copy.jump}</p><Combobox options={eventOptions} value={selectedId} onChange={setSelectedId} placeholder={copy.jump} /></div>
          {selected && <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
            <div className={`flex h-16 min-w-16 flex-col items-center justify-center rounded-2xl text-center ${selectedTiming.live ? "bg-emerald-400 text-black" : "bg-[var(--brand)] text-[var(--brand-ink)]"}`}><strong className="text-base leading-none">{selectedTiming.value}</strong>{selectedTiming.label && <span className="mt-1 max-w-14 text-[8px] font-bold uppercase leading-tight">{selectedTiming.label}</span>}</div>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-xl font-semibold">{selected.name}</h2><Badge color={selected.status === "cancelled" ? "red" : selectedTiming.live ? "green" : "brand"}>{t(`eventStatus.${selected.status || "planning"}`)}</Badge></div><p className="mt-1 text-xs text-[var(--muted)]">{[selected.venueName, selected.location, selected.startDate].filter(Boolean).join(" · ") || "—"}</p></div>
            <div className="flex flex-wrap gap-2"><Button href={`/events/${selected.id}`}>{copy.openWorkspace}</Button><Button variant="secondary" href={`/accreditation?event=${selected.id}`}>{copy.openAccreditation}</Button></div>
          </div>}
        </div>
        {selected && <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/8 pt-4 md:grid-cols-5"><MiniStat label={copy.registrations} value={selected.count} /><MiniStat label={copy.confirmed} value={selected.confirmedCount} /><MiniStat label={copy.waiting} value={selected.waitingCount} /><MiniStat label={copy.attended} value={selected.attendedCount} /><MiniStat label={copy.notAttended} value={selected.notAttendedCount} /></div>}
      </Card>

      <Card className="mb-4 p-3"><div className="grid gap-3 lg:grid-cols-[1fr_auto]"><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.search} /><div className="flex flex-wrap gap-2">{[["today",copy.today],["upcoming",copy.upcoming],["past",copy.past],["cancelled",copy.cancelled],["all",copy.all]].map(([value,label]) => <button key={value} type="button" onClick={() => setScope(value)} className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${scope === value ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white/[.04] text-[var(--muted)] hover:text-white"}`}>{label} <span className="ml-1 opacity-60">{counts[value]}</span></button>)}</div></div></Card>

      {!filtered.length ? <EmptyState>{copy.noResults}</EmptyState> : <div className="space-y-3">{filtered.map((event) => <EventRow key={event.id} event={event} today={today} copy={copy} t={t} onSelect={() => setSelectedId(event.id)} />)}</div>}
    </>}
  </div>;
}

function MiniStat({ label, value }) {
  return <div className="rounded-2xl bg-white/[.035] p-3"><p className="text-[9px] font-semibold uppercase tracking-[.1em] text-[var(--muted)]">{label}</p><p className="mt-1 text-xl font-semibold">{value || 0}</p></div>;
}

function EventRow({ event, today, copy, t, onSelect }) {
  const eventTiming = timing(event, today, copy);
  return <Card className="p-4 transition hover:border-[var(--brand)]/55"><div className="grid gap-4 lg:grid-cols-[auto_minmax(230px,1fr)_minmax(430px,1.3fr)_auto] lg:items-center">
    <button type="button" onClick={onSelect} className={`flex h-16 min-w-16 flex-col items-center justify-center rounded-2xl text-center ${eventTiming.live ? "bg-emerald-400 text-black" : "bg-white/[.05] text-[var(--brand)]"}`}><strong className="text-base leading-none">{eventTiming.value}</strong>{eventTiming.label && <span className="mt-1 max-w-14 text-[8px] font-bold uppercase leading-tight">{eventTiming.label}</span>}</button>
    <button type="button" onClick={onSelect} className="min-w-0 text-left"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-lg font-semibold">{event.name}</h3><Badge color={event.status === "cancelled" ? "red" : eventTiming.live ? "green" : "gray"}>{t(`eventStatus.${event.status || "planning"}`)}</Badge></div><p className="mt-1 text-xs text-[var(--muted)]">{[event.venueName, event.location, event.startDate].filter(Boolean).join(" · ") || "—"}</p></button>
    <div className="grid grid-cols-4 gap-2"><MiniStat label={copy.registrations} value={event.count} /><MiniStat label={copy.confirmed} value={event.confirmedCount} /><MiniStat label={copy.attended} value={event.attendedCount} /><MiniStat label={copy.notAttended} value={event.notAttendedCount} /></div>
    <Link href={`/events/${event.id}`} className="rounded-2xl border border-[var(--border)] px-4 py-2.5 text-center text-sm font-semibold hover:border-[var(--brand)]">{copy.openWorkspace} →</Link>
  </div></Card>;
}
