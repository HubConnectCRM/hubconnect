import { requireProfile } from "@/lib/auth";
import CallCenterView from "@/components/CallCenterView";
import CallPicker from "@/components/calls/CallPicker";

export default async function CallsPage() {
  const { supabase, profile } = await requireProfile();

  const [{ data: contacts }, { data: logs }, { data: registrations }, { data: leads }, { data: teammates }] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, full_name, job_title, email, phone, linkedin, source, notes, owner_id, company:companies(id, name, sector, country, city, website, overview)")
      .order("full_name")
      .limit(3000),
    supabase
      .from("call_logs")
      .select("id, contact_id, interaction_type, outcome, note, created_at, contact:contacts(id, full_name, company:companies(name)), logger:profiles!call_logs_logged_by_fkey(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("event_registrations")
      .select("id, contact_id, rsvp, event:events(id, name)")
      .limit(5000),
    supabase
      .from("lead_contacts")
      .select("id, contact_id, status, probability, reconnect_at, next_step, file:lead_files(id, name)")
      .not("status", "in", "(won,lost)")
      .limit(5000),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .neq("id", profile.id)
      .order("full_name"),
  ]);

  const related = {};
  for (const registration of registrations || []) {
    if (!related[registration.contact_id]) related[registration.contact_id] = [];
    related[registration.contact_id].push({
      value: `event:${registration.id}`,
      kind: "event",
      title: registration.event?.name || "Event",
      rsvp: registration.rsvp || "pending",
    });
  }
  for (const lead of leads || []) {
    if (!related[lead.contact_id]) related[lead.contact_id] = [];
    related[lead.contact_id].push({
      value: `lead:${lead.id}`,
      kind: "lead",
      title: lead.file?.name || "Lead",
      status: lead.status || "meeting",
      probability: lead.probability || "t70",
      reconnectAt: lead.reconnect_at || "",
      nextStep: lead.next_step || "",
    });
  }

  const companyMap = new Map();
  for (const contact of contacts || []) {
    if (!contact.company?.id) continue;
    if (!companyMap.has(contact.company.id)) companyMap.set(contact.company.id, { ...contact.company, contacts: [] });
    companyMap.get(contact.company.id).contacts.push(contact);
  }

  return (
    <div className="space-y-8">
      <CallPicker profile={profile} teammates={teammates || []} />
      <CallCenterView contacts={contacts || []} companies={Array.from(companyMap.values())} logs={logs || []} related={related} />
    </div>
  );
}
