"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import Combobox from "@/components/Combobox";
import { createClient } from "@/lib/supabase/client";

const EVENT_STATUSES = ["desiderata", "invited", "registered", "waiting_list", "confirmed", "declined"];
const TYPES = ["guest", "speaker", "reserved_seat", "staff"];
const BADGES = ["exists", "missing", "no_badge"];
const STATUS_COLORS = { desiderata: "gray", invited: "blue", registered: "brand", waiting_list: "amber", confirmed: "green", declined: "red" };
const ATTENDANCE_COLORS = { pending: "gray", attended: "green", not_attended: "red" };

const COPY = {
  en: { subtitle: "Fast event-day desk", assigned: "Assigned access", adminAccess: "Admin access", noAccess: "No accreditation event is assigned to you today.", noAccessHint: "The Events team must assign you to an event and set today's access window.", eventDecision: "Events team", eventDay: "Event day", confirmed: "Confirmed", confirmedByEvents: "Confirmed by Events team", waitingByEvents: "Waiting list by Events team", attended: "Attended", notAttended: "Not attended", pending: "Not marked", all: "All registrations", speakers: "Speakers", badgeIssues: "Badge issues", importExcel: "Import Excel", eventPicker: "Search and select an event", today: "TODAY", liveEvent: "EVENT DAY", daysLeft: "days left", daysAgo: "days ago", rows: "rows", select: "Select", person: "Person", companyRole: "Company / role", contact: "Contact", note: "Desk note", type: "Type", badge: "Badge", consent: "Data consent", recorded: "Recorded by", hub: "Hub", partner: "Partner", selected: "selected", markArrived: "Attended", markAbsent: "Not attended", clearResult: "Clear result", badgeExists: "Badge exists", clear: "Clear selection", saveError: "The change could not be saved. Your previous value was restored.", allTypes: "All types", allStatuses: "All event decisions", searchHint: "Type a guest name, company, role, email or phone…", reset: "Reset", empty: "No matching guests.", readOnly: "Read-only accreditation", readOnlyHint: "Only users assigned by the Events team can edit event-day results.", live: "Live sync" },
  tr: { subtitle: "Hızlı etkinlik günü masası", assigned: "Atanmış erişim", adminAccess: "Admin erişimi", noAccess: "Bugün için sana atanmış accreditation etkinliği yok.", noAccessHint: "Events ekibi seni etkinliğe atamalı ve bugünü kapsayan erişim tarihini belirlemeli.", eventDecision: "Events ekibi", eventDay: "Etkinlik günü", confirmed: "Confirmed", confirmedByEvents: "Events ekibi tarafından confirmed", waitingByEvents: "Events ekibi waiting list", attended: "Geldi", notAttended: "Gelmedi", pending: "İşaretlenmedi", all: "Tüm kayıtlar", speakers: "Speaker", badgeIssues: "Badge sorunları", importExcel: "Excel içe aktar", eventPicker: "Event ara ve seç", today: "BUGÜN", liveEvent: "EVENT GÜNÜ", daysLeft: "gün kaldı", daysAgo: "gün önce", rows: "satır", select: "Seç", person: "Kişi", companyRole: "Şirket / görev", contact: "İletişim", note: "Masa notu", type: "Tip", badge: "Badge", consent: "Veri izinleri", recorded: "İşaretleyen", hub: "Hub", partner: "Partner", selected: "seçili", markArrived: "Geldi", markAbsent: "Gelmedi", clearResult: "Sonucu temizle", badgeExists: "Badge mevcut", clear: "Seçimi temizle", saveError: "Değişiklik kaydedilemedi; önceki değer geri getirildi.", allTypes: "Tüm tipler", allStatuses: "Tüm Events kararları", searchHint: "Misafir adı, şirket, görev, e-posta veya telefon yaz…", reset: "Sıfırla", empty: "Eşleşen misafir yok.", readOnly: "Salt okunur accreditation", readOnlyHint: "Etkinlik günü sonuçlarını yalnızca Events ekibinin atadığı kullanıcılar düzenleyebilir.", live: "Canlı senkron" },
  it: { subtitle: "Desk rapido per il giorno dell'evento", assigned: "Accesso assegnato", adminAccess: "Accesso admin", noAccess: "Nessun evento di accreditamento ti è stato assegnato per oggi.", noAccessHint: "Il team Events deve assegnarti all'evento e includere oggi nelle date di accesso.", eventDecision: "Team Events", eventDay: "Giorno evento", confirmed: "Confermato", confirmedByEvents: "Confermato dal team Events", waitingByEvents: "Waiting list del team Events", attended: "Presente", notAttended: "Non presente", pending: "Non segnato", all: "Tutte le registrazioni", speakers: "Speaker", badgeIssues: "Problemi badge", importExcel: "Importa Excel", eventPicker: "Cerca e seleziona un evento", today: "OGGI", liveEvent: "GIORNO EVENTO", daysLeft: "giorni mancanti", daysAgo: "giorni fa", rows: "righe", select: "Seleziona", person: "Persona", companyRole: "Azienda / ruolo", contact: "Contatto", note: "Nota desk", type: "Tipo", badge: "Badge", consent: "Consensi dati", recorded: "Registrato da", hub: "Hub", partner: "Partner", selected: "selezionati", markArrived: "Presente", markAbsent: "Non presente", clearResult: "Cancella esito", badgeExists: "Badge presente", clear: "Cancella selezione", saveError: "Impossibile salvare; il valore precedente è stato ripristinato.", allTypes: "Tutti i tipi", allStatuses: "Tutte le decisioni Events", searchHint: "Digita nome, azienda, ruolo, email o telefono…", reset: "Azzera", empty: "Nessun ospite corrispondente.", readOnly: "Accreditamento in sola lettura", readOnlyHint: "Solo gli utenti assegnati dal team Events possono modificare gli esiti del giorno.", live: "Sincronizzazione live" },
};

function isConfirmed(row) {
  return row.rsvp === "yes" || row.status === "confirmed";
}

function localDateKey(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function eventTiming(event, copy) {
  const today = localDateKey();
  const start = event?.start_date || null;
  const end = event?.end_date || start;
  if (start && start <= today && (!end || end >= today)) return { live: true, value: copy.today, label: copy.liveEvent };
  if (!start) return { live: false, value: "—", label: "" };
  const days = Math.round((new Date(`${start}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000);
  return { live: false, value: Math.abs(days), label: days >= 0 ? copy.daysLeft : copy.daysAgo };
}

function attendanceLabel(value, copy) {
  return value === "attended" ? copy.attended : value === "not_attended" ? copy.notAttended : copy.pending;
}

export default function AccreditationConsole({ events, selectedEvent, initialEventId, initialRows, currentUser, canEdit = false, accessRestricted = false }) {
  const { t, i18n } = useTranslation();
  const copy = COPY[i18n.language?.slice(0, 2)] || COPY.en;
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState(initialRows);
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("event_confirmed");
  const [badge, setBadge] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState({ key: "name", direction: "asc" });
  const [selected, setSelected] = useState(() => new Set());
  const [savingIds, setSavingIds] = useState(() => new Set());
  const [error, setError] = useState("");

  useEffect(() => { setRows(initialRows); setSelected(new Set()); setScope("event_confirmed"); }, [initialRows]);

  useEffect(() => {
    if (!initialEventId) return;
    const channel = supabase.channel(`accreditation-${initialEventId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "event_registrations", filter: `event_id=eq.${initialEventId}` }, ({ new: changed }) => {
        setRows((current) => current.map((row) => row.id === changed.id ? { ...row, ...changed } : row));
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [initialEventId, supabase]);

  const confirmed = rows.filter(isConfirmed).length;
  const eventWaiting = rows.filter((row) => row.status === "waiting_list").length;
  const attended = rows.filter((row) => row.attendance_status === "attended" || row.arrived).length;
  const notAttended = rows.filter((row) => row.attendance_status === "not_attended").length;
  const notMarked = rows.filter((row) => isConfirmed(row) && (row.attendance_status || "pending") === "pending").length;
  const missing = rows.filter((row) => isConfirmed(row) && row.badge_status !== "exists").length;
  const speakerCount = rows.filter((row) => isConfirmed(row) && row.participant_type === "speaker").length;
  const timing = eventTiming(selectedEvent, copy);
  const eventOptions = useMemo(() => events.map((event) => {
    const eventTime = eventTiming(event, copy);
    const timingLabel = eventTime.live ? copy.today : event.start_date ? `${event.start_date}` : "—";
    return { value: event.id, label: `${eventTime.live ? `${copy.today} · ` : ""}${event.name} · ${timingLabel}${event.location ? ` · ${event.location}` : ""}` };
  }), [events, copy]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const result = rows.filter((row) => {
      const c = row.contact || {};
      const haystack = [c.full_name, c.company?.name, c.email, c.phone, c.job_title, row.event_day_note, row.last_note, row.notes].filter(Boolean).join(" ").toLowerCase();
      if (term && !haystack.includes(term)) return false;
      if (scope === "event_confirmed" && !isConfirmed(row)) return false;
      if (scope === "event_waiting" && row.status !== "waiting_list") return false;
      if (scope === "attended" && row.attendance_status !== "attended" && !row.arrived) return false;
      if (scope === "not_attended" && row.attendance_status !== "not_attended") return false;
      if (scope === "pending" && (!isConfirmed(row) || (row.attendance_status || "pending") !== "pending")) return false;
      if (scope === "speaker" && row.participant_type !== "speaker") return false;
      if (scope === "badge" && row.badge_status === "exists") return false;
      if (badge && row.badge_status !== badge) return false;
      if (type && row.participant_type !== type) return false;
      if (status && row.status !== status) return false;
      return true;
    });
    const value = (row) => sort.key === "company" ? row.contact?.company?.name || "" : sort.key === "decision" ? row.status || "" : sort.key === "attendance" ? row.attendance_status || "pending" : sort.key === "type" ? row.participant_type || "" : sort.key === "badge" ? row.badge_status || "" : row.contact?.full_name || "";
    return result.sort((a, b) => String(value(a)).localeCompare(String(value(b)), i18n.language) * (sort.direction === "asc" ? 1 : -1));
  }, [rows, q, scope, badge, type, status, sort, i18n.language]);

  async function patchRows(ids, values) {
    if (!canEdit || !ids.length) return;
    setError("");
    const previous = new Map(rows.filter((row) => ids.includes(row.id)).map((row) => [row.id, row]));
    const optimistic = { ...values };
    if (values.attendance_status) {
      optimistic.arrived = values.attendance_status === "attended";
      optimistic.attendance_recorded_at = new Date().toISOString();
      optimistic.checked_in_at = values.attendance_status === "attended" ? new Date().toISOString() : null;
      optimistic.checked_in_by_profile = values.attendance_status === "attended" ? { full_name: currentUser.full_name } : null;
    }
    setSavingIds(new Set(ids));
    setRows((current) => current.map((row) => ids.includes(row.id) ? { ...row, ...optimistic } : row));
    const { error: saveError } = await supabase.rpc("update_accreditation_registrations", { p_registration_ids: ids, p_patch: values });
    if (saveError) {
      setRows((current) => current.map((row) => previous.get(row.id) || row));
      setError(`${copy.saveError} ${saveError.message}`);
    }
    setSavingIds(new Set());
  }

  const selectedIds = Array.from(selected);
  const allVisibleSelected = filtered.length > 0 && filtered.every((row) => selected.has(row.id));
  const toggleSort = (key) => setSort((current) => current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" });
  const resetFilters = () => { setQ(""); setBadge(""); setType(""); setStatus(""); setScope("event_confirmed"); };

  if (!initialEventId) return <div className="mx-auto max-w-4xl"><PageHeader title={t("accreditation.title")} subtitle={copy.subtitle} /><Card className="border-amber-400/30 p-8 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10 text-2xl">🔒</div><h2 className="mt-4 text-xl font-semibold">{copy.noAccess}</h2><p className="mx-auto mt-2 max-w-xl text-sm text-[var(--muted)]">{copy.noAccessHint}</p></Card></div>;

  return <div className="mx-auto max-w-[1800px]">
    <PageHeader title={t("accreditation.title")} subtitle={`${copy.subtitle} · ${copy.live}`}>
      {canEdit && ["admin", "event"].includes(currentUser.role) && <Button href={`/import?destination=event&eventId=${initialEventId}`}>{copy.importExcel}</Button>}
      <Button variant="secondary" href={`/api/export/accreditation?event=${initialEventId}`}>{t("accreditation.export")}</Button>
    </PageHeader>

    <Card className="mb-4 overflow-visible border-[var(--brand)]/25">
      <div className="grid items-center gap-4 p-4 lg:grid-cols-[auto_minmax(0,1fr)_minmax(320px,520px)]">
        <div className={`flex h-16 min-w-16 flex-col items-center justify-center rounded-2xl text-center font-bold ${timing.live ? "bg-emerald-400 text-black" : "bg-[var(--brand)] text-[var(--brand-ink)]"}`}><strong className="text-base leading-none">{timing.value}</strong>{timing.label && <span className="mt-1 max-w-14 text-[8px] uppercase leading-tight">{timing.label}</span>}</div>
        <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-lg font-semibold">{selectedEvent?.name}</h2><Badge color={canEdit ? "green" : "gray"}>{currentUser.role === "admin" ? copy.adminAccess : canEdit ? copy.assigned : copy.readOnly}</Badge>{timing.live && <Badge color="green">{copy.liveEvent}</Badge>}</div><p className="mt-1 text-xs text-[var(--muted)]">{[selectedEvent?.start_date, selectedEvent?.end_date && selectedEvent.end_date !== selectedEvent.start_date ? selectedEvent.end_date : null, selectedEvent?.location].filter(Boolean).join(" · ") || "Event-day workspace"}</p></div>
        <div><p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-[var(--muted)]">{copy.eventPicker}</p><Combobox options={eventOptions} value={initialEventId} onChange={(eventId) => router.push(`/accreditation?event=${eventId}`)} placeholder={copy.eventPicker} /></div>
      </div>
      {!canEdit && accessRestricted && <div className="border-t border-amber-400/20 bg-amber-400/[.06] px-4 py-3 text-xs text-amber-100">{copy.readOnlyHint}</div>}
    </Card>

    <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <MetricButton label={copy.confirmedByEvents} value={confirmed} active={scope === "event_confirmed"} onClick={() => setScope("event_confirmed")} />
      <MetricButton label={copy.waitingByEvents} value={eventWaiting} active={scope === "event_waiting"} onClick={() => setScope("event_waiting")} />
      <MetricButton label={`${copy.eventDay} · ${copy.attended}`} value={attended} active={scope === "attended"} tone="success" onClick={() => setScope("attended")} />
      <MetricButton label={`${copy.eventDay} · ${copy.notAttended}`} value={notAttended} active={scope === "not_attended"} tone="danger" onClick={() => setScope("not_attended")} />
      <MetricButton label={`${copy.eventDay} · ${copy.pending}`} value={notMarked} active={scope === "pending"} onClick={() => setScope("pending")} />
      <MetricButton label={copy.badgeIssues} value={missing} active={scope === "badge"} tone="warning" onClick={() => setScope("badge")} />
    </div>

    <div className="mb-3 flex flex-wrap items-center gap-2"><button type="button" onClick={() => setScope("speaker")} className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${scope === "speaker" ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "border border-[var(--border)] text-[var(--muted)] hover:text-white"}`}>{copy.speakers} · {speakerCount}</button><button type="button" onClick={() => setScope("all")} className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${scope === "all" ? "bg-[var(--brand)] text-[var(--brand-ink)]" : "border border-[var(--border)] text-[var(--muted)] hover:text-white"}`}>{copy.all} · {rows.length}</button></div>

    <Card className="mb-3 p-3"><div className="grid gap-2 lg:grid-cols-[minmax(320px,1fr)_180px_180px_190px_auto]">
      <Input autoFocus value={q} onChange={(event) => setQ(event.target.value)} placeholder={copy.searchHint} className="text-base" />
      <Select value={type} onChange={(event) => setType(event.target.value)}><option value="">{copy.allTypes}</option>{TYPES.map((value) => <option key={value} value={value}>{typeLabel(value, t)}</option>)}</Select>
      <Select value={badge} onChange={(event) => setBadge(event.target.value)}><option value="">{t("accreditation.allBadges")}</option>{BADGES.map((value) => <option key={value} value={value}>{badgeLabel(value, t)}</option>)}</Select>
      <Select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{copy.allStatuses}</option>{EVENT_STATUSES.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</Select>
      <Button type="button" variant="secondary" onClick={resetFilters}>{copy.reset}</Button>
    </div></Card>

    {canEdit && selected.size > 0 && <Card className="mb-3 flex flex-wrap items-center gap-2 border-[var(--brand)]/40 p-3"><strong className="mr-2 text-sm text-[var(--brand)]">{selected.size} {copy.selected}</strong><Button type="button" onClick={() => patchRows(selectedIds, { attendance_status: "attended" })}>{copy.markArrived}</Button><Button type="button" variant="secondary" onClick={() => patchRows(selectedIds, { attendance_status: "not_attended" })}>{copy.markAbsent}</Button><Button type="button" variant="secondary" onClick={() => patchRows(selectedIds, { attendance_status: "pending" })}>{copy.clearResult}</Button><Button type="button" variant="secondary" onClick={() => patchRows(selectedIds, { badge_status: "exists" })}>{copy.badgeExists}</Button><Button type="button" variant="secondary" onClick={() => setSelected(new Set())}>{copy.clear}</Button></Card>}
    {error && <Card className="mb-3 border-red-500/40 p-3 text-sm text-red-300">{error}</Card>}

    {!filtered.length ? <EmptyState>{copy.empty}</EmptyState> : <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]"><span>{filtered.length} {copy.rows}</span><span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-400" />{copy.live}</span></div>
      <div className="max-h-[calc(100vh-230px)] overflow-auto"><table className="min-w-[1660px] w-full border-separate border-spacing-0 text-sm"><thead className="sticky top-0 z-30 bg-[#20211f] text-left text-[11px] uppercase tracking-[.08em] text-[var(--muted)]"><tr>
        {canEdit && <th className="sticky left-0 z-40 w-12 border-b border-r border-[var(--border)] bg-[#20211f] px-3 py-3"><input type="checkbox" aria-label={copy.select} checked={allVisibleSelected} onChange={(event) => setSelected(event.target.checked ? new Set(filtered.map((row) => row.id)) : new Set())} /></th>}
        <SortableHead className={`sticky ${canEdit ? "left-12" : "left-0"} z-40 min-w-[210px] bg-[#20211f]`} label={copy.person} sortKey="name" sort={sort} onSort={toggleSort} />
        <SortableHead label={copy.eventDecision} sortKey="decision" sort={sort} onSort={toggleSort} />
        <SortableHead className="min-w-[285px]" label={copy.eventDay} sortKey="attendance" sort={sort} onSort={toggleSort} />
        <th className="min-w-[190px] border-b border-r border-[var(--border)] px-3 py-3">{copy.note}</th>
        <SortableHead className="min-w-[210px]" label={copy.companyRole} sortKey="company" sort={sort} onSort={toggleSort} />
        <th className="min-w-[230px] border-b border-r border-[var(--border)] px-3 py-3">{copy.contact}</th>
        <SortableHead label={copy.type} sortKey="type" sort={sort} onSort={toggleSort} />
        <SortableHead label={copy.badge} sortKey="badge" sort={sort} onSort={toggleSort} />
        <th className="min-w-[140px] border-b border-r border-[var(--border)] px-3 py-3">{copy.consent}</th>
        <th className="min-w-[160px] border-b border-[var(--border)] px-3 py-3">{copy.recorded}</th>
      </tr></thead><tbody>{filtered.map((row) => <AccreditationRow key={row.id} row={row} canEdit={canEdit} selected={selected.has(row.id)} saving={savingIds.has(row.id)} onSelect={(checked) => setSelected((current) => { const next = new Set(current); if (checked) next.add(row.id); else next.delete(row.id); return next; })} onPatch={(values) => patchRows([row.id], values)} t={t} copy={copy} />)}</tbody></table></div>
    </Card>}
  </div>;
}

function MetricButton({ label, value, active, tone, onClick }) {
  const activeTone = tone === "success" ? "border-emerald-300 bg-emerald-400 text-black" : tone === "danger" ? "border-red-300 bg-red-400 text-black" : tone === "warning" ? "border-amber-300 bg-amber-300 text-black" : "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]";
  return <button type="button" aria-pressed={active} onClick={onClick} className={`min-h-28 rounded-3xl border p-4 text-left shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-[var(--brand)] ${active ? activeTone : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"}`}><span className="block text-[10px] font-semibold uppercase tracking-[.12em] opacity-65">{label}</span><strong className="mt-3 block text-3xl leading-none">{value}</strong><span className={`mt-3 block h-1 w-8 rounded-full ${active ? "bg-black/35" : "bg-[var(--brand)]/50"}`} /></button>;
}

function SortableHead({ label, sortKey, sort, onSort, className = "" }) {
  return <th className={`${className} border-b border-r border-[var(--border)] px-3 py-3`}><button type="button" onClick={() => onSort(sortKey)} className="flex w-full items-center justify-between gap-2 text-left"><span>{label}</span>{sort.key === sortKey && <span className="text-[var(--brand)]">{sort.direction === "asc" ? "↑" : "↓"}</span>}</button></th>;
}

function AccreditationRow({ row, canEdit, selected, saving, onSelect, onPatch, t, copy }) {
  const c = row.contact || {};
  const attendance = row.attendance_status || (row.arrived ? "attended" : "pending");
  const muted = row.status === "declined";
  return <tr className={`${attendance === "attended" ? "bg-emerald-400/[.06]" : attendance === "not_attended" ? "bg-red-400/[.035]" : muted ? "opacity-60" : "hover:bg-white/[.025]"} ${saving ? "animate-pulse" : ""}`}>
    {canEdit && <td className="sticky left-0 z-20 border-b border-r border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"><input type="checkbox" aria-label={`${copy.select} ${c.full_name || ""}`} checked={selected} onChange={(event) => onSelect(event.target.checked)} /></td>}
    <td className={`sticky ${canEdit ? "left-12" : "left-0"} z-20 border-b border-r border-[var(--border)] bg-[var(--surface)] px-3 py-2.5`}><a href={`/contacts/${c.id}`} className="font-semibold hover:text-[var(--brand)]">{c.full_name || "—"}</a><div className="mt-1 flex gap-1.5"><Badge color={row.registration_source === "sales" ? "blue" : "gray"}>{row.registration_source || "event"}</Badge>{row.participant_type === "speaker" && <Badge color="brand">Speaker</Badge>}</div></td>
    <td className="border-b border-r border-[var(--border)] px-3 py-2.5"><Badge color={STATUS_COLORS[row.status] || "gray"}>{statusLabel(row.status)}</Badge><p className="mt-1 text-[10px] text-[var(--muted)]">{row.rsvp === "yes" ? copy.confirmed : row.rsvp === "no" ? "Declined" : row.rsvp === "maybe" ? "Maybe" : "—"}</p></td>
    <td className="border-b border-r border-[var(--border)] px-2 py-2"><AttendanceControl value={attendance} disabled={!canEdit || saving} copy={copy} onChange={(value) => onPatch({ attendance_status: value })} /></td>
    <td className="border-b border-r border-[var(--border)] px-2 py-2"><InlineNote value={row.event_day_note || ""} disabled={!canEdit} onSave={(value) => onPatch({ event_day_note: value || null })} /></td>
    <td className="border-b border-r border-[var(--border)] px-3 py-2.5"><p className="font-medium">{c.company?.name || "—"}</p><p className="mt-1 text-xs text-[var(--muted)]">{c.job_title || "—"}</p>{(c.city || c.country) && <p className="mt-1 text-[10px] text-zinc-600">{[c.city, c.country].filter(Boolean).join(" · ")}</p>}</td>
    <td className="border-b border-r border-[var(--border)] px-3 py-2.5"><p className="truncate text-xs">{c.email || "—"}</p><p className="mt-1 text-xs text-[var(--muted)]">{c.phone || "—"}</p></td>
    <td className="border-b border-r border-[var(--border)] px-2 py-2"><select disabled={!canEdit} value={row.participant_type || "guest"} onChange={(event) => onPatch({ participant_type: event.target.value })} className="h-9 w-full rounded-lg border border-white/10 bg-black/25 px-2 text-xs text-white outline-none disabled:opacity-60">{TYPES.map((value) => <option key={value} value={value}>{typeLabel(value, t)}</option>)}</select></td>
    <td className="border-b border-r border-[var(--border)] px-2 py-2"><select disabled={!canEdit} value={row.badge_status || "exists"} onChange={(event) => onPatch({ badge_status: event.target.value })} className={`h-9 w-full rounded-lg border bg-black/25 px-2 text-xs font-semibold outline-none disabled:opacity-60 ${row.badge_status === "exists" ? "border-emerald-400/30 text-emerald-300" : row.badge_status === "missing" ? "border-amber-400/40 text-amber-300" : "border-red-400/40 text-red-300"}`}>{BADGES.map((value) => <option key={value} value={value}>{badgeLabel(value, t)}</option>)}</select></td>
    <td className="border-b border-r border-[var(--border)] px-3 py-2"><div className="flex items-center gap-3"><ConsentToggle label={copy.hub} checked={!!row.hub_consent} disabled={!canEdit} onChange={(value) => onPatch({ hub_consent: value })} /><ConsentToggle label={copy.partner} checked={!!row.partner_consent} disabled={!canEdit} onChange={(value) => onPatch({ partner_consent: value })} /></div></td>
    <td className="border-b border-[var(--border)] px-3 py-2.5"><p className="text-xs font-medium">{row.attendance_recorded_at ? new Date(row.attendance_recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</p><p className="mt-1 truncate text-[10px] text-[var(--muted)]">{row.checked_in_by_profile?.full_name || ""}</p></td>
  </tr>;
}

function AttendanceControl({ value, disabled, copy, onChange }) {
  const choices = [["attended", "✓", copy.attended], ["not_attended", "×", copy.notAttended], ["pending", "–", copy.pending]];
  return <div className="grid grid-cols-3 gap-1">{choices.map(([key, icon, label]) => <button key={key} type="button" disabled={disabled} onClick={() => onChange(key)} title={label} className={`rounded-xl border px-2 py-2 text-center transition disabled:cursor-not-allowed ${value === key ? key === "attended" ? "border-emerald-400 bg-emerald-400 text-black" : key === "not_attended" ? "border-red-400 bg-red-400 text-black" : "border-white/25 bg-white/10 text-white" : "border-white/10 text-[var(--muted)] hover:border-[var(--brand)]"}`}><strong className="block text-base leading-none">{icon}</strong><span className="mt-1 block truncate text-[9px]">{label}</span></button>)}</div>;
}

function InlineNote({ value, disabled, onSave }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <textarea value={draft} disabled={disabled} onChange={(event) => setDraft(event.target.value)} onBlur={() => { if (!disabled && draft !== value) onSave(draft.trim()); }} rows={2} placeholder="…" className="min-h-12 w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-xs text-zinc-300 outline-none transition hover:border-white/10 focus:border-[var(--brand)] focus:bg-black/30 disabled:opacity-60" />;
}

function ConsentToggle({ label, checked, disabled, onChange }) {
  return <button type="button" disabled={disabled} onClick={() => onChange(!checked)} className="flex items-center gap-1.5 text-[10px] text-[var(--muted)] disabled:opacity-60"><span className={`flex h-5 w-5 items-center justify-center rounded-md border ${checked ? "border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-ink)]" : "border-white/15"}`}>{checked ? "✓" : ""}</span>{label}</button>;
}

function typeLabel(value, t) { return value === "speaker" ? t("participants.speaker") : value === "reserved_seat" ? t("participants.reservedSeat") : value === "staff" ? t("participants.staff") : t("participants.guest"); }
function badgeLabel(value, t) { return value === "missing" ? t("badges.missing") : value === "no_badge" ? t("badges.noBadge") : t("badges.exists"); }
function statusLabel(value) { return String(value || "registered").replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
