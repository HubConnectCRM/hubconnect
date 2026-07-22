import { requireProfile } from "@/lib/auth";
import AccreditationConsole from "@/components/AccreditationConsole";

function defaultEvent(events, today) {
  const live = events.find((event) => event.start_date && event.start_date <= today && (event.end_date || event.start_date) >= today);
  if (live) return live;
  const upcoming = events.filter((event) => !event.start_date || event.start_date >= today).sort((a, b) => String(a.start_date || "9999-12-31").localeCompare(String(b.start_date || "9999-12-31")))[0];
  if (upcoming) return upcoming;
  return [...events].filter((event) => event.start_date).sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))[0] || events[0] || null;
}

export default async function AccreditationPage({ searchParams }) {
  const query = await searchParams;
  const { supabase, profile } = await requireProfile();
  const isAdmin = profile.role === "admin";
  const today = new Date().toISOString().slice(0, 10);
  let events = [];
  let assignmentIds = new Set();

  if (isAdmin) {
    const { data } = await supabase.from("events").select("id, name, location, start_date, end_date, status").neq("status", "cancelled").order("start_date", { ascending: true });
    events = data || [];
  } else {
    const { data: assignments } = await supabase
      .from("event_accreditation_assignments")
      .select("event_id, event:events(id, name, location, start_date, end_date, status)")
      .eq("user_id", profile.id)
      .eq("active", true)
      .lte("access_starts_on", today)
      .gte("access_ends_on", today);
    events = (assignments || []).map((row) => row.event).filter((event) => event && event.status !== "cancelled");
    assignmentIds = new Set((assignments || []).map((row) => row.event_id));
  }

  const requestedEventId = query?.event || null;
  const automaticEvent = defaultEvent(events, today);
  const eventId = events.some((event) => event.id === requestedEventId) ? requestedEventId : automaticEvent?.id || null;
  const selectedEvent = events.find((event) => event.id === eventId) || null;
  const canEdit = !!eventId && (isAdmin || assignmentIds.has(eventId));
  let registrations = [];
  if (eventId) {
    const { data } = await supabase
      .from("event_registrations")
      .select("id, event_id, status, rsvp, participant_type, badge_status, arrived, attendance_status, event_day_note, attendance_recorded_at, checked_in_at, last_note, notes, registration_source, hub_consent, partner_consent, contact:contacts(id, full_name, job_title, email, phone, country, city, company:companies(id, name)), checked_in_by_profile:profiles!event_registrations_checked_in_by_fkey(full_name)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });
    registrations = data || [];
  }

  return <AccreditationConsole events={events} selectedEvent={selectedEvent} initialEventId={eventId} initialRows={registrations} currentUser={profile} canEdit={canEdit} accessRestricted={!isAdmin} />;
}
