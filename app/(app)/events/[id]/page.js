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

  const [{ data: registrations }, { data: contacts }, { data: groups }] =
    await Promise.all([
      supabase
        .from("event_registrations")
        .select(
          "id, status, rsvp, group_id, contact:contacts(id, full_name, job_title, email, phone, linkedin, source, company:companies(name), owner:profiles!contacts_owner_id_fkey(id, full_name, email)), history:registration_rsvp_history(rsvp, status, changed_at, changed_by:profiles(full_name))"
        )
        .eq("event_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("contacts")
        .select("id, full_name, company:companies(name)")
        .order("full_name")
        .limit(5000),
      supabase
        .from("contact_groups")
        .select("id, name")
        .eq("event_id", id)
        .order("created_at"),
    ]);

  return (
    <EventDetail
      event={event}
      registrations={registrations || []}
      contacts={contacts || []}
      groups={groups || []}
    />
  );
}
