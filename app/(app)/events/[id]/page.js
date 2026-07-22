import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import EventDetail from "@/components/EventDetail";

export default async function EventPage({ params }) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();

  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();
  if (!event) notFound();

  const [{ data: registrations }, { data: contacts }, { data: groups }, { data: owners }, { data: assignments }] =
    await Promise.all([
      supabase
        .from("event_registrations")
        .select(
          "id, status, rsvp, group_id, registration_source, requested_by, response_date, last_note, notes, participant_type, badge_status, arrived, attendance_status, event_day_note, checked_in_at, attendance_recorded_at, last_contacted_at, last_contacted_note, contact:contacts(id, full_name, job_title, email, phone, linkedin, source, company:companies(name), owner:profiles!contacts_owner_id_fkey(id, full_name, email)), responsible:profiles!requested_by(id, full_name, email), checked_in_by_profile:profiles!event_registrations_checked_in_by_fkey(full_name), history:registration_rsvp_history(rsvp, status, note, changed_at, changed_by:profiles(full_name))"
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
      supabase.from("profiles").select("id, full_name, email, role, is_active").eq("is_active", true).order("full_name"),
      supabase.from("event_accreditation_assignments").select("id, user_id, access_starts_on, access_ends_on, active, user:profiles!event_accreditation_assignments_user_id_fkey(id, full_name, email, role)").eq("event_id", id).eq("active", true).order("created_at"),
    ]);

  return (
    <EventDetail
      event={event}
      registrations={registrations || []}
      contacts={contacts || []}
      groups={groups || []}
      owners={owners || []}
      assignments={assignments || []}
      canManage={profile.role === "admin" || profile.role === "event"}
      currentRole={profile.role}
    />
  );
}
