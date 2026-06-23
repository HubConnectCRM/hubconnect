import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { Card, EmptyState, PageHeader, Button } from "@/components/ui";
import LeadFilesView from "@/components/LeadFilesView";

export default async function LeadsPage() {
  const { supabase } = await requireProfile();

  const { data: files } = await supabase
    .from("lead_files")
    .select("id, name, description, created_at, created_by:profiles(full_name, email)")
    .order("created_at", { ascending: false });

  const { data: counts } = await supabase
    .from("lead_contacts")
    .select("lead_file_id");

  const countMap = {};
  for (const lc of counts || []) {
    countMap[lc.lead_file_id] = (countMap[lc.lead_file_id] || 0) + 1;
  }

  const rows = (files || []).map((f) => ({
    ...f,
    contactCount: countMap[f.id] || 0,
  }));

  return <LeadFilesView files={rows} />;
}
