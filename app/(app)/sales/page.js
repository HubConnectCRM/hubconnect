import { requireProfile } from "@/lib/auth";
import SalesView from "@/components/SalesView";

export default async function SalesPage() {
  const { supabase } = await requireProfile();

  const [{ data: regs }, { data: owners }, { data: events }, { data: groups }] =
    await Promise.all([
      supabase
        .from("event_registrations")
        .select(
          "id, rsvp, status, last_note, last_activity_at, group_id, event:events(id, name), contact:contacts(id, full_name, email, phone, job_title, linkedin, company:companies(name), owner:profiles!contacts_owner_id_fkey(id, full_name, email))"
        )
        .eq("registration_source", "sales")
        .order("last_activity_at", { ascending: false, nullsFirst: false })
        .limit(5000),
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
      supabase.from("events").select("id, name").order("name"),
      supabase
        .from("contact_groups")
        .select("id, name, event_id")
        .not("event_id", "is", null)
        .order("name"),
    ]);

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, full_name, company:companies(name)")
    .order("full_name")
    .limit(5000);

  const rows = (regs || []).map((r) => ({
    id: r.id,
    contactId: r.contact?.id,
    contactName: r.contact?.full_name || "—",
    email: r.contact?.email || "",
    phone: r.contact?.phone || "",
    jobTitle: r.contact?.job_title || "",
    linkedin: r.contact?.linkedin || "",
    company: r.contact?.company?.name || "",
    eventId: r.event?.id || "",
    eventName: r.event?.name || "",
    ownerId: r.contact?.owner?.id || "",
    ownerName: r.contact?.owner?.full_name || r.contact?.owner?.email || "",
    rsvp: r.rsvp,
    groupId: r.group_id || "",
    lastNote: r.last_note,
    lastAt: r.last_activity_at,
  }));

  return (
    <SalesView
      rows={rows}
      owners={owners || []}
      events={events || []}
      groups={groups || []}
      contacts={contacts || []}
    />
  );
}
