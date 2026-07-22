import { requireProfile } from "@/lib/auth";
import EventsList from "@/components/EventsList";

export default async function EventsPage() {
  const { supabase, profile } = await requireProfile();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, location, venue_name, status, prospect_number, start_date, end_date, event_registrations(status, rsvp, attendance_status, arrived)")
    .order("start_date", { ascending: false, nullsFirst: false })
    .limit(2000);

  const rows = (events || []).map((e) => {
    const registrations = e.event_registrations || [];
    return {
      id: e.id,
      name: e.name,
      location: e.location,
      venueName: e.venue_name,
      status: e.status,
      prospectNumber: e.prospect_number,
      startDate: e.start_date,
      endDate: e.end_date,
      count: registrations.length,
      confirmedCount: registrations.filter((row) => row.rsvp === "yes" || row.status === "confirmed").length,
      waitingCount: registrations.filter((row) => row.status === "waiting_list").length,
      attendedCount: registrations.filter((row) => row.attendance_status === "attended" || row.arrived).length,
      notAttendedCount: registrations.filter((row) => row.attendance_status === "not_attended").length,
    };
  });

  return <EventsList events={rows} canManage={profile.role === "admin" || profile.role === "event"} />;
}
