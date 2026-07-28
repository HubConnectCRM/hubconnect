import ExcelJS from "exceljs";
import { requireProfile } from "@/lib/auth";

const EUR_FORMAT = '_-[$€-2]* #,##0.00_-;_-[$€-2]* \\-#,##0.00_-;_-[$€-2]* "-"??_-;_-@';
const NAVY = "FF002060";

// Company-wide rollup export — a flat scope-by-scope table (unlike the
// per-scope Bilancino export, there's no single COSTI/RICAVI layout to
// reproduce here since this spans every event/lead file at once).
export async function GET() {
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

  function scopeOf(row) {
    const eventId = row.pushed_event_id || row.event_id;
    if (eventId) return { key: `event:${eventId}`, name: eventNames.get(eventId) || "—" };
    if (row.lead_file_id) return { key: `leadFile:${row.lead_file_id}`, name: leadFileNames.get(row.lead_file_id) || "—" };
    return { key: "unscoped", name: null };
  }

  const rows = new Map();
  function bucket(scope) {
    if (!rows.has(scope.key)) rows.set(scope.key, { ...scope, cost: 0, revenue: 0 });
    return rows.get(scope.key);
  }
  for (const item of costItems || []) bucket(scopeOf(item)).cost += Number(item.imponibile || 0) + Number(item.iva || 0);
  for (const item of revenueItems || []) bucket(scopeOf(item)).revenue += Number(item.imponibile || 0) + Number(item.iva || 0);
  for (const deal of deals || []) bucket(scopeOf(deal)).revenue += Number(deal.offer_value || 0) + Number(deal.iva || 0);

  const scopeRows = Array.from(rows.values())
    .filter((row) => row.name)
    .map((row) => ({ ...row, net: row.revenue - row.cost }))
    .sort((a, b) => b.revenue - a.revenue);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HubConnect";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Bilancino Generale");
  sheet.columns = [{ width: 40 }, { width: 18 }, { width: 18 }, { width: 18 }];

  const header = sheet.getRow(1);
  header.values = ["Scope", "Ricavi", "Costi", "Utile Netto"];
  header.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; });

  scopeRows.forEach((row, index) => {
    const excelRow = sheet.getRow(index + 2);
    excelRow.values = [row.name, row.revenue, row.cost, row.net];
    for (const col of [2, 3, 4]) excelRow.getCell(col).numFmt = EUR_FORMAT;
  });

  const totalRow = sheet.getRow(scopeRows.length + 3);
  const totalRevenue = scopeRows.reduce((sum, row) => sum + row.revenue, 0);
  const totalCost = scopeRows.reduce((sum, row) => sum + row.cost, 0);
  totalRow.values = ["TOTALE", totalRevenue, totalCost, totalRevenue - totalCost];
  totalRow.font = { name: "Calibri", size: 11, bold: true };
  for (const col of [2, 3, 4]) totalRow.getCell(col).numFmt = EUR_FORMAT;

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Bilancino_Generale.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
