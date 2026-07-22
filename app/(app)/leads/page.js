import { requireProfile } from "@/lib/auth";
import LeadFilesView from "@/components/LeadFilesView";
import { summarizeLeadContacts } from "@/lib/leadMetrics";

export default async function LeadsPage() {
  const { supabase, profile } = await requireProfile();

  const { data: files, error: filesError } = await supabase
    .from("lead_files")
    .select("id, name, description, created_at, linked_event_id, status, approval_status, created_by:profiles!lead_files_created_by_fkey(full_name, email), linked_event:events!lead_files_linked_event_id_fkey(id, name)")
    .order("created_at", { ascending: false });

  const [{ data: counts, error: countsError }, { data: deals, error: dealsError }] = await Promise.all([
    supabase.from("lead_contacts").select("lead_file_id, contact_id, probability, status"),
    supabase.from("deals").select("id, lead_file_id, stage, notes, po_won, pushed_event_id, reps:deal_reps(contact_id)"),
  ]);

  const loadError = filesError?.message || countsError?.message || dealsError?.message || null;

  const countMap = {};
  for (const d of counts || []) {
    if (d.lead_file_id) countMap[d.lead_file_id] = (countMap[d.lead_file_id] || 0) + 1;
  }

  const rows = (files || []).map((f) => {
    const fileContacts = (counts || []).filter((d) => d.lead_file_id === f.id);
    const fileDeals = (deals || []).filter((d) => d.lead_file_id === f.id);
    const performance = summarizeLeadContacts(fileContacts, fileDeals);
    return {
      ...f,
      contactCount: countMap[f.id] || 0,
      dealCount: fileDeals.length,
      wonCount: Math.max(
        fileDeals.filter((d) => String(d.stage).toLowerCase() === "won" || d.pushed_event_id).length,
        fileContacts.filter((d) => String(d.status).toLowerCase() === "won").length,
      ),
      t90Count: performance.byProbability.T90.total,
      t70Count: performance.byProbability.T70.total,
      t50Count: performance.byProbability.T50.total,
      performance,
    };
  });

  return <LeadFilesView files={rows} loadError={loadError} canEdit={profile.role === "admin" || profile.role === "sales"} />;
}
