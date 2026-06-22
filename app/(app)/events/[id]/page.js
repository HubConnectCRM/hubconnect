import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import EventDetail from "@/components/EventDetail";

export default async function EventPage({ params }) {
  const { id } = await params;
  const { supabase } = await requireProfile();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();
  if (!event) notFound();

  const [{ data: registrations }, { data: contacts }] = await Promise.all([
    supabase
      .from("event_registrations")
      .select(
        "id, status, contact:contacts(id, full_name, company:companies(name), owner:profiles!contacts_owner_id_fkey(id, full_name, email))"
      )
      .eq("event_id", id),
    supabase
      .from("contacts")
      .select("id, full_name, company:companies(name)")
      .order("full_name")
      .limit(5000),
  ]);

  return (
    <EventDetail
      event={event}
      registrations={registrations || []}
      contacts={contacts || []}
    />
  );
}
