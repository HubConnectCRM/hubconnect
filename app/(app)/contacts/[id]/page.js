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

  const [{ data: interactions }, { data: registrations }] = await Promise.all([
    supabase
      .from("interactions")
      .select("*, user:profiles(id, full_name, email)")
      .eq("contact_id", id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("event_registrations")
      .select("id, status, event:events(id, name, start_date)")
      .eq("contact_id", id),
  ]);

  return (
    <ContactDetail
      contact={contact}
      interactions={interactions || []}
      registrations={registrations || []}
    />
  );
}
