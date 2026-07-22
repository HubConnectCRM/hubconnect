import { requireProfile } from "@/lib/auth";
import { workbookResponse } from "@/lib/excel";

const COLUMNS = [
  { header: "Registration ID", key: "registrationId", width: 38 },
  { header: "Contact ID", key: "contactId", width: 38 },
  { header: "Nome", key: "firstName", width: 22 },
  { header: "Cognome", key: "lastName", width: 24 },
  { header: "Nome completo", key: "name", width: 30 },
  { header: "Job Title", key: "role", width: 24 },
  { header: "Company", key: "company", width: 26 },
  { header: "Mail", key: "email", width: 30 },
  { header: "Secondary Mail", key: "secondaryEmail", width: 30 },
  { header: "Cellulare", key: "phone", width: 18 },
  { header: "LinkedIn", key: "linkedin", width: 34 },
  { header: "Paese", key: "country", width: 16 },
  { header: "Città", key: "city", width: 16 },
  { header: "Contact Source", key: "contactSource", width: 18 },
  { header: "Contact Owner", key: "contactOwner", width: 24 },
  { header: "Contact Notes", key: "contactNotes", width: 34 },
  { header: "Contact GDPR", key: "contactGdpr", width: 16 },
  { header: "Contact GDPR Date", key: "contactGdprDate", width: 18 },
  { header: "Events Team Decision", key: "eventDecision", width: 26 },
  { header: "Events Status", key: "eventStatus", width: 20 },
  { header: "RSVP", key: "rsvp", width: 14 },
  { header: "Responsible", key: "responsible", width: 24 },
  { header: "Sub-group", key: "group", width: 22 },
  { header: "Registration Source", key: "registrationSource", width: 20 },
  { header: "Response Date", key: "responseDate", width: 18 },
  { header: "Last Activity", key: "lastActivity", width: 22 },
  { header: "Last Contacted", key: "lastContacted", width: 22 },
  { header: "Last Contact Note", key: "lastContactNote", width: 34 },
  { header: "Events Last Note", key: "eventLastNote", width: 34 },
  { header: "Events Notes", key: "eventNotes", width: 34 },
  { header: "Registration GDPR", key: "registrationGdpr", width: 18 },
  { header: "Participant Type", key: "type", width: 18 },
  { header: "Badge", key: "badge", width: 18 },
  { header: "Event Day Result", key: "eventDay", width: 20 },
  { header: "Arrived", key: "arrived", width: 12 },
  { header: "Event Day Note", key: "deskNotes", width: 34 },
  { header: "Attendance Recorded At", key: "attendanceRecordedAt", width: 24 },
  { header: "Attendance Recorded By", key: "attendanceRecordedBy", width: 26 },
  { header: "Check-in At", key: "checkin", width: 24 },
  { header: "Check-in By", key: "checkinBy", width: 24 },
  { header: "Hub Consent", key: "hubConsent", width: 16 },
  { header: "Partner Consent", key: "partnerConsent", width: 18 },
  { header: "Registration Created", key: "createdAt", width: 24 },
  { header: "Registration Updated", key: "updatedAt", width: 24 },
];

const ACCREDITI_COLUMNS = [
  { header: "Presenza", key: "presenza", width: 11, align: "center" },
  { header: "note", key: "operationalNote", width: 28 },
  { header: "Nome", key: "firstName", width: 22 },
  { header: "Cognome", key: "lastName", width: 24 },
  { header: "Job Title", key: "role", width: 30 },
  { header: "Company", key: "company", width: 30 },
  { header: "Mail", key: "email", width: 34 },
  { header: "cellulare", key: "phone", width: 22 },
  { header: "Paese", key: "country", width: 16 },
  { header: "Città", key: "city", width: 18 },
  { header: "Trattamento dati Hub", key: "hubConsentItalian", width: 24, align: "center" },
  { header: "Trattamento dati Partner", key: "partnerConsentItalian", width: 28, align: "center" },
];

const PARTICIPANT_COLUMNS = ACCREDITI_COLUMNS.slice(2);

function yesNo(value) {
  return value ? "YES" : "NO";
}

function eventsDecision(row) {
  if (row.rsvp === "yes" || row.status === "confirmed") return "CONFIRMED";
  if (row.rsvp === "no" || row.status === "declined") return "DECLINED";
  if (row.status === "waiting_list") return "WAITING LIST";
  return String(row.status || "REGISTERED").replaceAll("_", " ").toUpperCase();
}

function splitName(contact) {
  const firstName = String(contact?.first_name || "").trim();
  const lastName = String(contact?.last_name || "").trim();
  if (firstName || lastName) return { firstName, lastName };
  const parts = String(contact?.full_name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) };
}

function operationalNote(row) {
  const notes = [];
  if (row.participant_type === "speaker") notes.push("speaker");
  if (row.participant_type === "reserved_seat") notes.push("RISERVATO");
  if (row.participant_type === "staff") notes.push("staff");
  if (row.badge_status === "missing") notes.push("badge missing");
  if (row.badge_status === "no_badge") notes.push("no badge");
  if (row.status === "waiting_list") notes.push("waiting list");
  if (row.event_day_note) notes.push(row.event_day_note);
  else if (row.last_note) notes.push(row.last_note);
  else if (row.notes) notes.push(row.notes);
  return notes.filter(Boolean).join(" · ");
}

function alphabetical(rows) {
  return [...rows].sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "it", { sensitivity: "base" }));
}

function statusRank(row) {
  if (row.eventDecision === "CONFIRMED") return 0;
  if (row.eventDecision === "WAITING LIST") return 1;
  if (row.eventDecision === "DECLINED" || row.eventDay === "not_attended") return 3;
  return 2;
}

export async function GET(request) {
  const eventId = new URL(request.url).searchParams.get("event");
  const { supabase } = await requireProfile();
  if (!eventId) return new Response("event_required", { status: 400 });

  const [{ data: event, error: eventError }, { data: rows, error: rowsError }] = await Promise.all([
    supabase.from("events").select("id, name, location, venue_name, status, prospect_number, start_date, end_date, description, created_at, creator:profiles!events_created_by_fkey(full_name, email)").eq("id", eventId).single(),
    supabase.from("event_registrations").select("id, contact_id, status, rsvp, response_date, last_activity_at, gdpr_consent, participant_type, badge_status, arrived, attendance_status, event_day_note, attendance_recorded_at, checked_in_at, last_contacted_at, last_contacted_note, last_note, notes, registration_source, hub_consent, partner_consent, created_at, updated_at, group:contact_groups(name), responsible:profiles!requested_by(full_name, email), attendance_recorded_by_profile:profiles!event_registrations_attendance_recorded_by_fkey(full_name, email), checked_in_by_profile:profiles!event_registrations_checked_in_by_fkey(full_name, email), contact:contacts(id, first_name, last_name, full_name, job_title, email, secondary_email, phone, linkedin, country, city, source, gdpr_consent, gdpr_consent_date, notes, created_at, owner:profiles!contacts_owner_id_fkey(full_name, email), company:companies(name))").eq("event_id", eventId).order("created_at"),
  ]);
  if (eventError || rowsError) return new Response(eventError?.message || rowsError?.message || "export_failed", { status: 500 });

  const mapped = (rows || []).map((row) => {
    const { firstName, lastName } = splitName(row.contact);
    const eventDay = row.attendance_status || (row.arrived ? "attended" : "pending");
    return {
    registrationId: row.id,
    contactId: row.contact_id || row.contact?.id,
    firstName,
    lastName,
    name: row.contact?.full_name,
    role: row.contact?.job_title,
    company: row.contact?.company?.name,
    email: row.contact?.email,
    secondaryEmail: row.contact?.secondary_email,
    phone: row.contact?.phone,
    linkedin: row.contact?.linkedin,
    country: row.contact?.country,
    city: row.contact?.city,
    contactSource: row.contact?.source,
    contactOwner: row.contact?.owner?.full_name || row.contact?.owner?.email,
    contactNotes: row.contact?.notes,
    contactGdpr: yesNo(row.contact?.gdpr_consent),
    contactGdprDate: row.contact?.gdpr_consent_date,
    eventDecision: eventsDecision(row),
    eventStatus: row.status,
    rsvp: row.rsvp || "NOT SET",
    responsible: row.responsible?.full_name || row.responsible?.email,
    group: row.group?.name,
    registrationSource: row.registration_source,
    responseDate: row.response_date,
    lastActivity: row.last_activity_at,
    lastContacted: row.last_contacted_at,
    lastContactNote: row.last_contacted_note,
    eventLastNote: row.last_note,
    eventNotes: row.notes,
    registrationGdpr: yesNo(row.gdpr_consent),
    type: row.participant_type,
    badge: row.badge_status,
    eventDay,
    arrived: yesNo(row.attendance_status === "attended" || row.arrived),
    deskNotes: row.event_day_note,
    attendanceRecordedAt: row.attendance_recorded_at,
    attendanceRecordedBy: row.attendance_recorded_by_profile?.full_name || row.attendance_recorded_by_profile?.email,
    checkin: row.checked_in_at,
    checkinBy: row.checked_in_by_profile?.full_name || row.checked_in_by_profile?.email,
    hubConsent: yesNo(row.hub_consent),
    partnerConsent: yesNo(row.partner_consent),
    hubConsentItalian: row.hub_consent ? "si" : "",
    partnerConsentItalian: row.partner_consent ? "si" : "",
    presenza: eventDay === "attended" ? 1 : eventDay === "not_attended" ? 0 : null,
    operationalNote: operationalNote(row),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    };
  });

  const confirmed = mapped.filter((row) => row.eventDecision === "CONFIRMED");
  const waiting = mapped.filter((row) => row.eventDecision === "WAITING LIST");
  const attended = mapped.filter((row) => row.eventDay === "attended");
  const notAttended = mapped.filter((row) => row.eventDay === "not_attended");
  const notMarked = confirmed.filter((row) => row.eventDay === "pending");
  const summaryRows = [
    { metric: "Event", value: event?.name },
    { metric: "Status", value: event?.status },
    { metric: "Start Date", value: event?.start_date },
    { metric: "End Date", value: event?.end_date },
    { metric: "Venue", value: event?.venue_name },
    { metric: "Location", value: event?.location },
    { metric: "Prospect Number", value: event?.prospect_number },
    { metric: "Created By", value: event?.creator?.full_name || event?.creator?.email },
    { metric: "Description", value: event?.description },
    { metric: "All Registrations", value: mapped.length },
    { metric: "Confirmed by Events Team", value: confirmed.length },
    { metric: "Waiting List by Events Team", value: waiting.length },
    { metric: "Event Day Attended", value: attended.length },
    { metric: "Event Day Not Attended", value: notAttended.length },
    { metric: "Event Day Not Marked", value: notMarked.length },
    { metric: "Speakers", value: mapped.filter((row) => row.type === "speaker").length },
    { metric: "Reserved Seats", value: mapped.filter((row) => row.type === "reserved_seat").length },
    { metric: "Badge Issues", value: mapped.filter((row) => row.badge !== "exists").length },
  ];

  const operationalRows = alphabetical(mapped);
  const sponsorRows = [...mapped].sort((a, b) => statusRank(a) - statusRank(b) || `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "it", { sensitivity: "base" }));
  const specialRows = alphabetical(mapped.filter((row) => row.type === "speaker" || row.type === "reserved_seat" || row.badge !== "exists"));
  const redRow = (row) => row.eventDecision === "DECLINED" || row.eventDay === "not_attended" ? "FFFF4D4D" : null;
  const sheets = [
    {
      name: "accrediti",
      columns: ACCREDITI_COLUMNS,
      rows: operationalRows,
      freezeColumns: 4,
      rowHeight: 22,
      rowFill: redRow,
      cellFill: (row, key) => key === "operationalNote" && /badge missing|no badge/i.test(row.operationalNote || "") ? "FFFFD9DF" : null,
    },
    {
      name: "lista partecipanti sponsor",
      columns: PARTICIPANT_COLUMNS,
      rows: sponsorRows,
      freezeColumns: 2,
      rowHeight: 22,
      rowFill: (row) => {
        if (row.eventDecision === "CONFIRMED") return "FF7FF36B";
        if (row.eventDecision === "WAITING LIST") return "FFFFE08A";
        if (row.eventDecision === "DECLINED" || row.eventDay === "not_attended") return "FFFF4D4D";
        return null;
      },
    },
    {
      name: "speaker e posti riservati",
      columns: ACCREDITI_COLUMNS,
      rows: specialRows,
      freezeColumns: 4,
      rowHeight: 22,
      cellFill: (row, key) => key === "operationalNote" ? "FFFFE4EA" : null,
    },
    { name: "Riepilogo", columns: [{ header: "Voce", key: "metric", width: 32 }, { header: "Valore", key: "value", width: 70 }], rows: summaryRows, autoFilter: false, freezeColumns: 1 },
    { name: "Dettaglio completo", columns: COLUMNS, rows: operationalRows, freezeColumns: 5 },
  ];
  return workbookResponse(`Lista_accrediti_${event?.name || "Event"}.xlsx`, sheets);
}
