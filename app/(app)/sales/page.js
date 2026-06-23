import { requireProfile } from "@/lib/auth";
import SalesView from "@/components/SalesView";

export default async function SalesPage() {
  const { supabase } = await requireProfile();

  const [
    { data: regs },
    { data: leadContacts },
    { data: owners },
    { data: events },
    { data: leadFiles },
    { data: groups },
  ] = await Promise.all([
    supabase
      .from("event_registrations")
      .select(
        "id, rsvp, status, last_note, last_activity_at, group_id, event:events(id, name), contact:contacts(id, full_name, email, phone, job_title, linkedin, company:companies(name), owner:profiles!contacts_owner_id_fkey(id, full_name, email))"
      )
      .eq("registration_source", "sales")
      .order("last_activity_at", { ascending: false, nullsFirst: false })
      .limit(5000),
    supabase
      .from("lead_contacts")
      .select(
        "id, rsvp, notes, created_at, group_id, lead_file:lead_files(id, name), contact:contacts(id, full_name, email, phone, job_title, linkedin, company:companies(name), owner:profiles!contacts_owner_id_fkey(id, full_name, email))"
      )
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    supabase.from("events").select("id, name").order("name"),
    supabase.from("lead_files").select("id, name").order("name"),
    supabase
      .from("contact_groups")
      .select("id, name, event_id, lead_file_id")
      .order("name"),
  ]);

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, full_name, company:companies(name)")
    .order("full_name")
    .limit(5000);

  const eventRows = (regs || []).map((r) => ({
    id: r.id,
    type: "event",
    contactId: r.contact?.id,
    contactName: r.contact?.full_name || "—",
    email: r.contact?.email || "",
    phone: r.contact?.phone || "",
    jobTitle: r.contact?.job_title || "",
    linkedin: r.contact?.linkedin || "",
    company: r.contact?.company?.name || "",
    fileId: r.event?.id || "",
    fileName: r.event?.name || "",
    ownerId: r.contact?.owner?.id || "",
    ownerName: r.contact?.owner?.full_name || r.contact?.owner?.email || "",
    rsvp: r.rsvp,
    groupId: r.group_id || "",
    lastNote: r.last_note,
    lastAt: r.last_activity_at,
  }));

  const leadRows = (leadContacts || []).map((lc) => ({
    id: lc.id,
    type: "lead",
    contactId: lc.contact?.id,
    contactName: lc.contact?.full_name || "—",
    email: lc.contact?.email || "",
    phone: lc.contact?.phone || "",
    jobTitle: lc.contact?.job_title || "",
    linkedin: lc.contact?.linkedin || "",
    company: lc.contact?.company?.name || "",
    fileId: lc.lead_file?.id || "",
    fileName: lc.lead_file?.name || "",
    ownerId: lc.contact?.owner?.id || "",
    ownerName: lc.contact?.owner?.full_name || lc.contact?.owner?.email || "",
    rsvp: lc.rsvp,
    groupId: lc.group_id || "",
    lastNote: lc.notes,
    lastAt: lc.created_at,
  }));

  const rows = [...eventRows, ...leadRows].sort((a, b) => {
    if (!a.lastAt) return 1;
    if (!b.lastAt) return -1;
    return new Date(b.lastAt) - new Date(a.lastAt);
  });

  return (
    <SalesView
      rows={rows}
      owners={owners || []}
      events={events || []}
      leadFiles={leadFiles || []}
      groups={groups || []}
      contacts={contacts || []}
    />
  );
}
