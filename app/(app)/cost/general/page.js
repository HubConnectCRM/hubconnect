import { requireProfile } from "@/lib/auth";
import CostGeneralView from "@/components/CostGeneralView";

// A company-wide rollup across every event/lead file's Cost sheet — same
// underlying cost_items/revenue_items/won-deals data as the per-scope Cost
// sheet (app/(app)/cost/page.js), just aggregated instead of filtered to one
// event or lead file.
export default async function CostGeneralPage() {
  const { supabase } = await requireProfile();

  const [{ data: events }, { data: leadFiles }, { data: costItems }, { data: revenueItems }, { data: deals }] = await Promise.all([
    supabase.from("events").select("id, name"),
    supabase.from("lead_files").select("id, name"),
    supabase.from("cost_items").select("event_id, lead_file_id, imponibile, iva"),
    supabase.from("revenue_items").select("event_id, lead_file_id, imponibile, iva"),
    supabase.from("deals").select("event_id, pushed_event_id, lead_file_id, offer_value, iva").eq("stage", "won"),
  ]);

  const eventNames = new Map((events || []).map((e) => [e.id, e.name]));
  const leadFileNames = new Map((leadFiles || []).map((f) => [f.id, f.name]));

  // A won deal can be attributed to an event via either pushed_event_id
  // (Sales' "push to event") or event_id — prefer pushed_event_id so a deal
  // isn't double-counted if both happen to be set.
  function scopeOf(row) {
    const eventId = row.pushed_event_id || row.event_id;
    if (eventId) return { key: `event:${eventId}`, kind: "event", name: eventNames.get(eventId) || "—" };
    if (row.lead_file_id) return { key: `leadFile:${row.lead_file_id}`, kind: "leadFile", name: leadFileNames.get(row.lead_file_id) || "—" };
    return { key: "unscoped", kind: "unscoped", name: null };
  }

  const rows = new Map();
  function bucket(scope) {
    if (!rows.has(scope.key)) rows.set(scope.key, { ...scope, cost: 0, revenue: 0 });
    return rows.get(scope.key);
  }

  for (const item of costItems || []) {
    const scope = scopeOf(item);
    bucket(scope).cost += Number(item.imponibile || 0) + Number(item.iva || 0);
  }
  for (const item of revenueItems || []) {
    const scope = scopeOf(item);
    bucket(scope).revenue += Number(item.imponibile || 0) + Number(item.iva || 0);
  }
  for (const deal of deals || []) {
    const scope = scopeOf(deal);
    bucket(scope).revenue += Number(deal.offer_value || 0) + Number(deal.iva || 0);
  }

  const scopeRows = Array.from(rows.values())
    .filter((row) => row.name)
    .map((row) => ({ ...row, net: row.revenue - row.cost }))
    .sort((a, b) => b.revenue - a.revenue);

  const totals = scopeRows.reduce(
    (acc, row) => ({ revenue: acc.revenue + row.revenue, cost: acc.cost + row.cost }),
    { revenue: 0, cost: 0 }
  );

  return <CostGeneralView scopeRows={scopeRows} totals={totals} />;
}
