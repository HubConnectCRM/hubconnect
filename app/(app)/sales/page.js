import { requireProfile } from "@/lib/auth";
import SalesView from "@/components/SalesView";

export default async function SalesPage() {
  const { supabase } = await requireProfile();

  const [{ data: deals }, { data: owners }, { data: events }, { data: leadFiles }] =
    await Promise.all([
      supabase
        .from("deals")
        .select(
          "id, company_name, stage, po_won, pushed_event_id, group_id, owner_id, lead_file_id, created_at, company:companies(id, name), owner:profiles!deals_owner_id_fkey(id, full_name, email), lead_file:lead_files(id, name), pushed_event:events(id, name), group:contact_groups(name), reps:deal_reps(id, rsvp, contact:contacts(id, full_name, email, phone, job_title))"
        )
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase.from("profiles").select("id, full_name, email").order("full_name"),
      supabase.from("events").select("id, name").order("name"),
      supabase.from("lead_files").select("id, name").order("name"),
    ]);

  return (
    <SalesView
      deals={deals || []}
      owners={owners || []}
      events={events || []}
      leadFiles={leadFiles || []}
    />
  );
}
