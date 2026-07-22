import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import ContactDetail from "@/components/ContactDetail";

export default async function ContactPage({ params }) {
  const { id } = await params;
  const { supabase } = await requireProfile();

  const { data: contact } = await supabase
    .from("contacts")
    .select(
      "*, company:companies(id, name), owner:profiles!contacts_owner_id_fkey(id, full_name, email)"
    )
    .eq("id", id)
    .single();

  if (!contact) notFound();

  const [{ data: interactions }, { data: registrations }, { data: events }, { data: teammates }, { data: callLogs }, { data: shares }] =
    await Promise.all([
      supabase
        .from("interactions")
        .select("*, user:profiles(id, full_name, email)")
        .eq("contact_id", id)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("event_registrations")
        .select("id, status, rsvp, event:events(id, name, start_date)")
        .eq("contact_id", id),
      supabase.from("events").select("id, name").order("name").limit(2000),
      supabase.from("profiles").select("id, full_name, email, role").eq("is_active", true).order("full_name"),
      supabase.from("call_logs").select("id, interaction_type, outcome, note, created_at, user:profiles(full_name)").eq("contact_id", id).order("created_at", { ascending: false }).limit(20),
      supabase.from("contact_shares").select("id, note, created_at, shared_with_profile:profiles!shared_with(full_name, email)").eq("contact_id", id).order("created_at", { ascending: false }),
    ]);

  return (
    <ContactDetail
      contact={contact}
      interactions={interactions || []}
      registrations={registrations || []}
      events={events || []}
      teammates={teammates || []}
      callLogs={callLogs || []}
      shares={shares || []}
    />
  );
}
