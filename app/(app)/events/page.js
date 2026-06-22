import { requireProfile } from "@/lib/auth";
import EventsList from "@/components/EventsList";

export default async function EventsPage() {
  const { supabase } = await requireProfile();

  const { data: events } = await supabase
    .from("events")
    .select("id, name, location, start_date, end_date, event_registrations(count)")
    .order("start_date", { ascending: false, nullsFirst: false })
    .limit(2000);

  const rows = (events || []).map((e) => ({
    id: e.id,
    name: e.name,
    location: e.location,
    startDate: e.start_date,
    count: e.event_registrations?.[0]?.count ?? 0,
  }));

  return <EventsList events={rows} />;
}
