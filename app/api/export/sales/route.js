import { requireProfile } from "@/lib/auth";
import { workbookResponse } from "@/lib/excel";

export async function GET(request) {
  const owner = new URL(request.url).searchParams.get("owner");
  const { supabase } = await requireProfile();
  let query = supabase.from("deals").select("stage, offer_value, currency, notes, created_at, updated_at, company_name, company:companies(name), owner:profiles!deals_owner_id_fkey(full_name, email), services").order("created_at", { ascending: false });
  if (owner) query = query.eq("owner_id", owner);
  const { data: deals } = await query;
  const rows = (deals || []).map((deal) => ({ owner: deal.owner?.full_name || deal.owner?.email, company: deal.company?.name || deal.company_name, service: (deal.services || []).join(", "), value: Number(deal.offer_value || 0), stage: deal.stage, created: deal.created_at, closed: ["won", "lost"].includes(deal.stage) ? deal.updated_at : "", notes: deal.notes }));
  const columns = [{ header: "Sales Owner", key: "owner", width: 24 }, { header: "Company", key: "company", width: 28 }, { header: "Service", key: "service", width: 28 }, { header: "Value", key: "value", width: 16 }, { header: "Stage", key: "stage", width: 16 }, { header: "Created", key: "created", width: 21 }, { header: "Closed", key: "closed", width: 21 }, { header: "Notes", key: "notes", width: 35 }];
  const sum = (items) => items.reduce((total, row) => total + row.value, 0);
  const pipeline = rows.filter((row) => ["prospect", "contacted", "in_progress", "proposal"].includes(row.stage));
  const closed = rows.filter((row) => row.stage === "won");
  const failed = rows.filter((row) => ["lost", "declined"].includes(row.stage));
  return workbookResponse("HubConnect_Sales.xlsx", [{ name: "Summary", columns: [{ header: "Portfolio", key: "name", width: 24 }, { header: "Count", key: "count", width: 12 }, { header: "Value", key: "value", width: 18 }], rows: [{ name: "Pipeline", count: pipeline.length, value: sum(pipeline) }, { name: "Closed", count: closed.length, value: sum(closed) }, { name: "Failed", count: failed.length, value: sum(failed) }] }, { name: "Pipeline", columns, rows: pipeline }, { name: "Closed", columns, rows: closed }, { name: "Failed", columns, rows: failed }]);
}
