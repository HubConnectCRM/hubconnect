import { requireProfile } from "@/lib/auth";
import { workbookResponse } from "@/lib/excel";

export async function GET(request) {
  const fileId = new URL(request.url).searchParams.get("file");
  const { supabase } = await requireProfile();
  if (!fileId) return new Response("file_required", { status: 400 });
  const [{ data: file }, { data: leads }] = await Promise.all([
    supabase.from("lead_files").select("name").eq("id", fileId).single(),
    supabase.from("lead_contacts").select("status, notes, probability, reconnect_at, next_step, estimated_value, owner:profiles!owner_id(full_name, email), contact:contacts(full_name, job_title, email, phone, company:companies(name))").eq("lead_file_id", fileId).order("created_at", { ascending: false }),
  ]);
  const columns = [{ header: "Company", key: "company", width: 28 }, { header: "Contact", key: "contact", width: 28 }, { header: "Job title", key: "role", width: 24 }, { header: "Email", key: "email", width: 30 }, { header: "Phone", key: "phone", width: 18 }, { header: "Sales owner", key: "owner", width: 24 }, { header: "Probability", key: "probability", width: 14 }, { header: "Status", key: "status", width: 16 }, { header: "Reconnect", key: "reconnect", width: 21 }, { header: "Next step", key: "next", width: 30 }, { header: "Feedback", key: "notes", width: 35 }, { header: "Estimated value", key: "value", width: 18 }];
  const rows = (leads || []).map((lead) => ({ company: lead.contact?.company?.name, contact: lead.contact?.full_name, role: lead.contact?.job_title, email: lead.contact?.email, phone: lead.contact?.phone, owner: lead.owner?.full_name || lead.owner?.email, probability: lead.probability, status: lead.status, reconnect: lead.reconnect_at, next: lead.next_step, notes: lead.notes, value: Number(lead.estimated_value || 0) }));
  const grouped = new Map();
  for (const row of rows) { const key = row.owner || "Unassigned"; if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(row); }
  return workbookResponse(`Leads_${file?.name || "File"}.xlsx`, [{ name: "All Leads", columns, rows }, ...Array.from(grouped.entries()).map(([name, ownerRows]) => ({ name, columns, rows: ownerRows }))]);
}
