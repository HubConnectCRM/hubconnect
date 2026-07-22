"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { createMeeting, deleteMeeting } from "@/app/(app)/calendar/actions";
import { calendarColor } from "@/lib/calendarPalette";

const COPY = {
  en: { newEvent: "New event", today: "Today", myCalendars: "My calendars", peopleCalendars: "People calendars", allDay: "All day", week: "Week", agenda: "Agenda", close: "Close", noTitle: "Busy", timezone: "Local time", more: "more", selected: "selected", noDayMeetings: "No meetings on this day" },
  tr: { newEvent: "Yeni etkinlik", today: "Bugün", myCalendars: "Takvimlerim", peopleCalendars: "Kişilerin takvimleri", allDay: "Tüm gün", week: "Hafta", agenda: "Ajanda", close: "Kapat", noTitle: "Meşgul", timezone: "Yerel saat", more: "daha", selected: "seçili", noDayMeetings: "Bu gün toplantı yok" },
  it: { newEvent: "Nuovo evento", today: "Oggi", myCalendars: "I miei calendari", peopleCalendars: "Calendari delle persone", allDay: "Tutto il giorno", week: "Settimana", agenda: "Agenda", close: "Chiudi", noTitle: "Occupato", timezone: "Ora locale", more: "altro", selected: "selezionati", noDayMeetings: "Nessuna riunione in questo giorno" },
};

const START_HOUR = 8;
const END_HOUR = 20;
const HOUR_HEIGHT = 76;

function mondayOf(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function addDays(value, amount) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);
  return date;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function localeCode(language) {
  return language?.startsWith("tr") ? "tr-TR" : language?.startsWith("it") ? "it-IT" : "en-GB";
}

export default function TeamCalendarView({ meetings, teammates, contacts, currentUserId, isAdmin }) {
  const { t, i18n } = useTranslation();
  const copy = COPY[i18n.language?.slice(0, 2)] || COPY.en;
  const locale = localeCode(i18n.language);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [selectedOwners, setSelectedOwners] = useState(() => new Set(teammates.map((person) => person.id).concat(currentUserId)));
  const [showComposer, setShowComposer] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [view, setView] = useState("week");
  const [agendaDay, setAgendaDay] = useState(() => new Date());
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const agendaDays = useMemo(() => { const today = new Date(); today.setHours(0, 0, 0, 0); return Array.from({ length: 53 }, (_, index) => addDays(today, index - 7)); }, []);
  const weekEnd = addDays(weekStart, 7);
  const ownerColors = useMemo(() => new Map(teammates.map((person) => [person.id, calendarColor(person.id, person.id === currentUserId)])), [teammates, currentUserId]);
  const visible = useMemo(() => meetings.filter((meeting) => selectedOwners.has(meeting.owner_id) && new Date(meeting.start_at) < weekEnd && new Date(meeting.end_at) > weekStart), [meetings, selectedOwners, weekStart, weekEnd]);
  const agendaVisible = useMemo(() => meetings.filter((meeting) => selectedOwners.has(meeting.owner_id) && new Date(meeting.start_at) >= agendaDays[0] && new Date(meeting.start_at) < addDays(agendaDays.at(-1), 1)), [meetings, selectedOwners, agendaDays]);
  const timed = visible.filter((meeting) => (new Date(meeting.end_at) - new Date(meeting.start_at)) < 20 * 60 * 60 * 1000);
  const allDay = visible.filter((meeting) => (new Date(meeting.end_at) - new Date(meeting.start_at)) >= 20 * 60 * 60 * 1000);
  const now = new Date();
  const nowDayIndex = weekDays.findIndex((day) => sameDay(day, now));
  const nowTop = ((now.getHours() + now.getMinutes() / 60) - START_HOUR) * HOUR_HEIGHT;

  useEffect(() => {
    if (agendaDay < weekStart || agendaDay >= weekEnd) setAgendaDay(weekStart);
  }, [weekStart]);

  function toggleOwner(id) {
    setSelectedOwners((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (next.size === 0) next.add(currentUserId);
      return next;
    });
  }

  const rangeLabel = `${weekDays[0].toLocaleDateString(locale, { day: "numeric", month: "short" })} – ${weekDays[6].toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="mx-auto max-w-[1800px]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">{t("contactCenter.calendarTitle")}</h1><p className="mt-1 text-sm text-[var(--muted)]">{t("contactCenter.calendarDescription")}</p></div>
        <div className="flex flex-wrap gap-2"><Button href="/contact-center" variant="secondary">{t("contactCenter.backToCenter")}</Button><Button type="button" onClick={() => setShowComposer(true)}>＋ {copy.newEvent}</Button></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <Button type="button" className="w-full py-4" onClick={() => setShowComposer(true)}>＋ {copy.newEvent}</Button>
          <MiniMonth anchor={weekStart} weekStart={weekStart} onSelect={(date) => setWeekStart(mondayOf(date))} locale={locale} />
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">{copy.peopleCalendars}</p><Badge color="brand">{selectedOwners.size} {copy.selected}</Badge></div>
            <div className="space-y-1.5">{teammates.map((person) => { const checked = selectedOwners.has(person.id); const color = ownerColors.get(person.id); return <button key={person.id} type="button" onClick={() => toggleOwner(person.id)} className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm transition ${checked ? "bg-white/[.06] text-white" : "text-[var(--muted)] hover:bg-white/[.03]"}`}><span className="flex h-5 w-5 items-center justify-center rounded-full border-2" style={{ borderColor: color, background: checked ? color : "transparent", color: "#0a0a0a" }}>{checked ? "✓" : ""}</span><span className="truncate">{person.id === currentUserId ? `${person.full_name || person.email} · ${t("contactCenter.me")}` : person.full_name || person.email}</span></button>; })}</div>
          </Card>
        </aside>

        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-3">
            <div className="flex items-center gap-2"><Button type="button" variant="secondary" onClick={() => setWeekStart(addDays(weekStart, -7))}>‹</Button><Button type="button" variant="secondary" onClick={() => setWeekStart(mondayOf(new Date()))}>{copy.today}</Button><Button type="button" variant="secondary" onClick={() => setWeekStart(addDays(weekStart, 7))}>›</Button><strong className="ml-2 text-sm sm:text-base">{rangeLabel}</strong></div>
            <div className="flex items-center gap-2 text-xs text-[var(--muted)]"><span>{copy.timezone}</span><button type="button" onClick={() => setView("week")} className={`rounded-lg px-3 py-2 ${view === "week" ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white/5"}`}>{copy.week}</button><button type="button" onClick={() => setView("agenda")} className={`rounded-lg px-3 py-2 ${view === "agenda" ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "bg-white/5"}`}>{copy.agenda}</button></div>
          </div>

          {view === "agenda" ? <AgendaView meetings={agendaVisible} days={agendaDays} selectedDay={agendaDay} onSelectDay={setAgendaDay} ownerColors={ownerColors} currentUserId={currentUserId} locale={locale} copy={copy} onOpen={setSelectedMeeting} /> : <div className="overflow-x-auto">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-[72px_repeat(7,minmax(120px,1fr))] border-b border-[var(--border)]">
                <div className="border-r border-[var(--border)] p-3 text-xs text-[var(--muted)]">GMT{new Date().getTimezoneOffset() <= 0 ? "+" : "-"}{Math.abs(new Date().getTimezoneOffset() / 60)}</div>
                {weekDays.map((day) => <div key={day.toISOString()} className={`border-r border-[var(--border)] px-3 py-2 last:border-r-0 ${sameDay(day, now) ? "bg-[var(--brand)]/10" : ""}`}><p className={`text-xs font-semibold uppercase ${sameDay(day, now) ? "text-[var(--brand)]" : "text-[var(--muted)]"}`}>{day.toLocaleDateString(locale, { weekday: "short" })}</p><p className={`mt-1 text-xl font-semibold ${sameDay(day, now) ? "text-[var(--brand)]" : ""}`}>{day.getDate()}</p></div>)}
              </div>

              <div className="grid min-h-[58px] grid-cols-[72px_repeat(7,minmax(120px,1fr))] border-b border-[var(--border)]">
                <div className="border-r border-[var(--border)] p-2 text-xs text-[var(--muted)]">{copy.allDay}</div>
                {weekDays.map((day, dayIndex) => <div key={day.toISOString()} className="border-r border-[var(--border)] p-1 last:border-r-0">{allDay.filter((meeting) => sameDay(new Date(meeting.start_at), day)).slice(0, 2).map((meeting) => <MeetingPill key={meeting.id} meeting={meeting} color={ownerColors.get(meeting.owner_id)} onClick={() => setSelectedMeeting(meeting)} />)}{allDay.filter((meeting) => sameDay(new Date(meeting.start_at), day)).length > 2 && <p className="px-1 text-[10px] text-[var(--muted)]">+{allDay.filter((meeting) => sameDay(new Date(meeting.start_at), day)).length - 2} {copy.more}</p>}</div>)}
              </div>

              <div className="relative grid grid-cols-[72px_repeat(7,minmax(120px,1fr))]" style={{ height: (END_HOUR - START_HOUR) * HOUR_HEIGHT }}>
                <div className="relative border-r border-[var(--border)]">{Array.from({ length: END_HOUR - START_HOUR }, (_, index) => <div key={index} className="absolute right-2 -translate-y-2 text-xs text-[var(--muted)]" style={{ top: index * HOUR_HEIGHT }}>{String(START_HOUR + index).padStart(2, "0")}:00</div>)}</div>
                {weekDays.map((day, dayIndex) => <div key={day.toISOString()} className={`relative border-r border-[var(--border)] last:border-r-0 ${sameDay(day, now) ? "bg-[var(--brand)]/[.025]" : ""}`} style={{ backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_HEIGHT - 1}px, rgba(255,255,255,.09) ${HOUR_HEIGHT - 1}px, rgba(255,255,255,.09) ${HOUR_HEIGHT}px), repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_HEIGHT / 2 - 1}px, rgba(255,255,255,.035) ${HOUR_HEIGHT / 2 - 1}px, rgba(255,255,255,.035) ${HOUR_HEIGHT / 2}px)` }}>
                  {timed.filter((meeting) => sameDay(new Date(meeting.start_at), day)).map((meeting) => <TimedMeeting key={meeting.id} meeting={meeting} color={ownerColors.get(meeting.owner_id)} onClick={() => setSelectedMeeting(meeting)} />)}
                  {dayIndex === nowDayIndex && nowTop >= 0 && nowTop <= (END_HOUR - START_HOUR) * HOUR_HEIGHT && <div className="pointer-events-none absolute left-0 right-0 z-20 border-t border-emerald-400" style={{ top: nowTop }}><span className="absolute -left-[66px] -top-2 rounded bg-emerald-400 px-1 text-[10px] font-semibold text-black">{now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</span><span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-emerald-400" /></div>}
                </div>)}
              </div>
            </div>
          </div>}
        </Card>
      </div>

      {showComposer && <ComposerModal contacts={contacts} onClose={() => setShowComposer(false)} />}
      {selectedMeeting && <MeetingDetail meeting={selectedMeeting} canDelete={isAdmin || selectedMeeting.owner_id === currentUserId} onClose={() => setSelectedMeeting(null)} color={ownerColors.get(selectedMeeting.owner_id)} />}
      <button type="button" aria-label={copy.newEvent} onClick={() => setShowComposer(true)} className="fixed bottom-8 right-8 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand)] text-3xl font-light text-[var(--brand-ink)] shadow-2xl transition hover:scale-105">＋</button>
    </div>
  );
}

function AgendaView({ meetings, days, selectedDay, onSelectDay, ownerColors, currentUserId, locale, copy, onOpen }) {
  const today = new Date();
  const tomorrow = addDays(today, 1);
  const grouped = days
    .map((day) => ({ day, rows: meetings.filter((meeting) => sameDay(new Date(meeting.start_at), day)).sort((a, b) => new Date(a.start_at) - new Date(b.start_at)) }))
    .filter((group) => group.rows.length && group.day >= new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate()));
  function heading(day) {
    const date = day.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
    if (sameDay(day, today)) return `${copy.today} • ${date}`;
    if (sameDay(day, tomorrow)) return `${locale.startsWith("tr") ? "Yarın" : locale.startsWith("it") ? "Domani" : "Tomorrow"} • ${date}`;
    return date;
  }
  function duration(row) { const minutes = Math.max(0, Math.round((new Date(row.end_at) - new Date(row.start_at)) / 60000)); const hours = Math.floor(minutes / 60); const rest = minutes % 60; const minuteUnit = locale.startsWith("tr") ? "d" : "min"; return hours ? `${hours}${locale.startsWith("tr") ? "sa" : "h"}${rest ? ` ${rest}${minuteUnit}` : ""}` : `${minutes}${minuteUnit}`; }
  return <div className="p-4">
    <div className="mb-5 flex gap-2 overflow-x-auto pb-2">{days.map((day) => <button key={day.toISOString()} type="button" onClick={() => onSelectDay(day)} className={`min-w-20 rounded-2xl border px-4 py-3 text-center ${sameDay(day, selectedDay) ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]" : "border-[var(--border)] bg-white/[.03]"}`}><span className="block text-[10px] font-semibold uppercase">{day.toLocaleDateString(locale, { weekday: "short" })}</span><strong className="mt-1 block text-xl">{day.getDate()}</strong></button>)}</div>
    {grouped.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted)]">{copy.noDayMeetings}</div> : <div className="space-y-6">{grouped.map(({ day, rows }) => <section key={day.toISOString()}><h3 className="mb-2 text-sm font-semibold capitalize text-[var(--muted)]">{heading(day)}</h3><div className="space-y-2">{rows.map((meeting) => { const start = new Date(meeting.start_at); const color = ownerColors.get(meeting.owner_id); return <button key={meeting.id} type="button" onClick={() => onOpen(meeting)} className="flex w-full items-center overflow-hidden rounded-2xl border border-[var(--border)] bg-white/[.03] text-left transition hover:border-white/20"><span className="w-1.5 self-stretch" style={{ background: color }} /><span className="w-24 shrink-0 p-4 text-sm font-semibold" style={{ color }}>{start.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}<small className="mt-1 block font-normal text-[var(--muted)]">{duration(meeting)}</small></span><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} /><span className="min-w-0 flex-1 p-4"><strong className="block truncate">{meeting.title || copy.noTitle}</strong><span className="mt-1 block truncate text-xs text-[var(--muted)]">{meeting.owner_id === currentUserId ? meeting.location || copy.noTitle : meeting.owner?.full_name || meeting.owner?.email || meeting.location || ""}</span></span></button>; })}</div></section>)}</div>}
  </div>;
}

function MiniMonth({ anchor, weekStart, onSelect, locale }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = mondayOf(first);
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
  return <Card className="p-4"><div className="mb-3 flex items-center justify-between"><p className="font-semibold">{anchor.toLocaleDateString(locale, { month: "long", year: "numeric" })}</p></div><div className="grid grid-cols-7 gap-1 text-center">{Array.from({ length: 7 }, (_, index) => addDays(mondayOf(new Date()), index).toLocaleDateString(locale, { weekday: "narrow" })).map((label, index) => <span key={`${label}-${index}`} className="pb-1 text-[10px] font-semibold text-[var(--muted)]">{label}</span>)}{days.map((day) => { const inMonth = day.getMonth() === anchor.getMonth(); const inWeek = day >= weekStart && day < addDays(weekStart, 7); return <button key={day.toISOString()} type="button" onClick={() => onSelect(day)} className={`rounded-lg py-1.5 text-xs ${inWeek ? "bg-[var(--brand)] text-[var(--brand-ink)]" : inMonth ? "hover:bg-white/10" : "text-zinc-700"}`}>{day.getDate()}</button>; })}</div></Card>;
}

function TimedMeeting({ meeting, color, onClick }) {
  const start = new Date(meeting.start_at); const end = new Date(meeting.end_at);
  const startValue = start.getHours() + start.getMinutes() / 60;
  const endValue = end.getHours() + end.getMinutes() / 60;
  const top = Math.max(0, (startValue - START_HOUR) * HOUR_HEIGHT);
  const height = Math.max(28, Math.min((END_HOUR - START_HOUR) * HOUR_HEIGHT - top, (endValue - startValue) * HOUR_HEIGHT));
  return <button type="button" onClick={onClick} className="absolute left-1 right-1 z-10 overflow-hidden rounded-lg border-l-4 p-2 text-left text-xs shadow-lg transition hover:z-30 hover:brightness-110" style={{ top, height, borderColor: color, background: `${color}25`, color: "white" }}><p className="truncate font-semibold">{meeting.title || "Busy"}</p><p className="mt-0.5 truncate text-[10px] opacity-70">{start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {meeting.owner?.full_name || meeting.owner?.email || ""}</p>{height > 55 && <p className="mt-1 truncate text-[10px] opacity-70">{meeting.contact?.full_name || meeting.location || meeting.meeting_link || ""}</p>}</button>;
}

function MeetingPill({ meeting, color, onClick }) {
  return <button type="button" onClick={onClick} className="mb-1 block w-full truncate rounded px-2 py-1 text-left text-[10px] font-semibold text-black" style={{ background: color }}>{meeting.title || "Busy"}</button>;
}

function ComposerModal({ contacts, onClose }) {
  const { t } = useTranslation(); const router = useRouter();
  const [state, action, pending] = useActionState(createMeeting, {});
  const start = new Date(Date.now() + 60 * 60 * 1000); start.setMinutes(0, 0, 0); const end = new Date(start.getTime() + 30 * 60 * 1000);
  const localValue = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  useEffect(() => { if (state?.ok) { router.refresh(); onClose(); } }, [state?.ok, router, onClose]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onMouseDown={onClose}><Card className="max-h-[92vh] w-full max-w-3xl overflow-auto p-5" onMouseDown={(event) => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold">{t("contactCenter.newMeeting")}</h2><Button type="button" variant="secondary" onClick={onClose}>{t("common.close")}</Button></div><form action={action} className="grid gap-4 md:grid-cols-2"><Field label={t("contactCenter.meetingTitle")}><Input name="title" required /></Field><Field label={t("contactCenter.contactOptional")}><Select name="contact_id" defaultValue=""><option value="">{t("common.none")}</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.full_name} · {contact.company?.name || ""}</option>)}</Select></Field><Field label={t("contactCenter.startsAt")}><Input name="start_at" type="datetime-local" defaultValue={localValue(start)} required /></Field><Field label={t("contactCenter.endsAt")}><Input name="end_at" type="datetime-local" defaultValue={localValue(end)} required /></Field><Field label={t("contactCenter.meetingLink")}><Input name="meeting_link" placeholder="Meet / Teams / Zoom" /></Field><Field label={t("events.location")}><Input name="location" /></Field><Field label={t("common.notes")} className="md:col-span-2"><Textarea name="note" rows={3} /></Field><div className="flex items-center gap-3 md:col-span-2"><Button type="submit" disabled={pending}>{pending ? t("common.saving") : t("common.save")}</Button>{state?.error && <span className="text-sm text-red-400">{state.error}</span>}</div></form></Card></div>;
}

function MeetingDetail({ meeting, canDelete, onClose, color }) {
  const { t } = useTranslation(); const [pending, startTransition] = useTransition(); const start = new Date(meeting.start_at); const end = new Date(meeting.end_at);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onMouseDown={onClose}><Card className="w-full max-w-xl overflow-hidden" onMouseDown={(event) => event.stopPropagation()}><div className="h-2" style={{ background: color }} /><div className="p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">{meeting.title || t("contactCenter.busy")}</h2><p className="mt-1 text-sm text-[var(--muted)]">{meeting.owner?.full_name || meeting.owner?.email || "—"}</p></div><Button type="button" variant="secondary" onClick={onClose}>{t("common.close")}</Button></div><div className="mt-5 space-y-3 text-sm"><p><strong>{start.toLocaleDateString()}</strong> · {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}–{end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>{meeting.contact && <p>{meeting.contact.full_name} · {meeting.contact.company?.name || "—"}</p>}{meeting.location && <p>{meeting.location}</p>}{meeting.note && <p className="rounded-2xl bg-white/5 p-3 text-[var(--muted)]">{meeting.note}</p>}</div><div className="mt-5 flex gap-2">{meeting.meeting_link && <Button href={meeting.meeting_link} target="_blank">{t("contactCenter.join")}</Button>}{canDelete && <Button type="button" variant="danger" disabled={pending} onClick={() => startTransition(async () => { await deleteMeeting(meeting.id); onClose(); })}>{t("common.delete")}</Button>}</div></div></Card></div>;
}
