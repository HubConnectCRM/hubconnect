import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import LeadFileDetail from "@/components/LeadFileDetail";
import { summarizeLeadContacts } from "@/lib/leadMetrics";

export default async function LeadFilePage({ params }) {
  const { id } = await params;
  const { supabase, profile } = await requireProfile();

  const [
    { data: file },
    { data: deals },
    { data: groups },
    { data: leadContacts },
    { data: companies },
    { data: contacts },
    { data: events },
    { data: owners },
  ] = await Promise.all([
    supabase.from("lead_files").select("*").eq("id", id).single(),
    supabase
      .from("deals")
      .select(
        "id, company_name, stage, po_won, pushed_event_id, group_id, owner_id, notes, created_at, company:companies(id, name), owner:profiles!deals_owner_id_fkey(id, full_name, email), pushed_event:events!deals_pushed_event_id_fkey(id, name), reps:deal_reps(id, contact_id, rsvp, notes, contact:contacts(id, full_name, email, phone, job_title, linkedin))"
      )
      .eq("lead_file_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("contact_groups")
      .select("id, name")
      .eq("lead_file_id", id)
      .order("created_at"),
    supabase
      .from("lead_contacts")
      .select("id, status, rsvp, notes, group_id, probability, pipeline_stage, reconnect_at, next_step, estimated_value, owner_id, created_at, owner:profiles!lead_contacts_owner_id_fkey(id, full_name, email), contact:contacts(id, full_name, email, phone, job_title, linkedin, source, notes, owner_id, company:companies(id, name, website, overview))")
      .eq("lead_file_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("companies").select("id, name, website, overview").order("name").limit(5000),
    supabase
      .from("contacts")
      .select("id, full_name, email, job_title, company:companies(name)")
      .order("full_name")
      .limit(5000),
    supabase.from("events").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);

  if (!file) notFound();

  const leadIds = (leadContacts || []).map((row) => row.id);
  let pipelineEvents = [];
  if (leadIds.length) {
    const { data } = await supabase
      .from("lead_pipeline_events")
      .select("id,lead_id,stage,changed_by,created_at")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: false });
    pipelineEvents = data || [];
  }

  return (
    <LeadFileDetail
      file={file}
      deals={deals || []}
      leadContacts={leadContacts || []}
      groups={groups || []}
      companies={companies || []}
      contacts={contacts || []}
      events={events || []}
      owners={owners || []}
      performance={summarizeLeadContacts(leadContacts || [], deals || [])}
      pipelineEvents={pipelineEvents}
      canEdit={profile.role === "admin" || profile.role === "sales"}
    />
  );
}
