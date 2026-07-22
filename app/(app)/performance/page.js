import { requireProfile } from "@/lib/auth";
import PerformanceView from "@/components/PerformanceView";

export default async function PerformancePage() {
  const { supabase } = await requireProfile();
  const [{ data: leads }, { data: deals }, { data: callLogs }] = await Promise.all([
    supabase
      .from("lead_contacts")
      .select("id,contact_id,status,probability,created_at,estimated_value,lead_file_id")
      .order("created_at", { ascending: false })
      .limit(10000),
    supabase
      .from("deals")
      .select("id,stage,po_won,created_at")
      .order("created_at", { ascending: false })
      .limit(10000),
    supabase.from("call_logs").select("contact_id,created_at").order("created_at", { ascending: false }).limit(10000),
  ]);

  const latestContact = new Map();
  for (const log of callLogs || []) if (!latestContact.has(log.contact_id)) latestContact.set(log.contact_id, log.created_at);
  const activityLeads = (leads || []).map((lead) => ({ ...lead, activity_at: latestContact.get(lead.contact_id) || lead.created_at }));
  return <PerformanceView leads={activityLeads} deals={deals || []} />;
}
