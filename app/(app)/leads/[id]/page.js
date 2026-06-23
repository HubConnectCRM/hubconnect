import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import LeadFileDetail from "@/components/LeadFileDetail";

export default async function LeadFilePage({ params }) {
  const { id } = await params;
  const { supabase } = await requireProfile();

  const [
    { data: file },
    { data: deals },
    { data: groups },
    { data: companies },
    { data: contacts },
    { data: events },
    { data: owners },
  ] = await Promise.all([
    supabase.from("lead_files").select("*").eq("id", id).single(),
    supabase
      .from("deals")
      .select(
        "id, company_name, stage, po_won, pushed_event_id, group_id, owner_id, notes, created_at, company:companies(id, name), owner:profiles!deals_owner_id_fkey(id, full_name, email), pushed_event:events(id, name), reps:deal_reps(id, rsvp, notes, contact:contacts(id, full_name, email, phone, job_title, linkedin))"
      )
      .eq("lead_file_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("contact_groups")
      .select("id, name")
      .eq("lead_file_id", id)
      .order("created_at"),
    supabase.from("companies").select("id, name").order("name").limit(5000),
    supabase
      .from("contacts")
      .select("id, full_name, company:companies(name)")
      .order("full_name")
      .limit(5000),
    supabase.from("events").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);

  if (!file) notFound();

  return (
    <LeadFileDetail
      file={file}
      deals={deals || []}
      groups={groups || []}
      companies={companies || []}
      contacts={contacts || []}
      events={events || []}
      owners={owners || []}
    />
  );
}
