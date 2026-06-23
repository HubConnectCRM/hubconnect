import { requireProfile } from "@/lib/auth";
import SalesView from "@/components/SalesView";

export default async function SalesPage() {
  const { supabase } = await requireProfile();

  const [{ data: regs }, { data: owners }, { data: events }] = await Promise.all([
    supabase
      .from("event_registrations")
      .select(
        "id, rsvp, status, last_note, last_activity_at, event:events(id, name), contact:contacts(id, full_name, company:companies(name), owner:profiles!contacts_owner_id_fkey(id, full_name, email))"
      )
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .limit(5000),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    supabase.from("events").select("id, name").order("name"),
  ]);

  const rows = (regs || []).map((r) => ({
    id: r.id,
    contactId: r.contact?.id,
    contactName: r.contact?.full_name || "—",
    company: r.contact?.company?.name || "",
    eventId: r.event?.id || "",
    eventName: r.event?.name || "",
    ownerId: r.contact?.owner?.id || "",
    ownerName: r.contact?.owner?.full_name || r.contact?.owner?.email || "",
    rsvp: r.rsvp,
    lastNote: r.last_note,
    lastAt: r.last_activity_at,
  }));

  return <SalesView rows={rows} owners={owners || []} events={events || []} />;
}
