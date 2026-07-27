import ExcelJS from "exceljs";
import { requireProfile } from "@/lib/auth";

const EUR_FORMAT = '_-[$€-2]* #,##0.00_-;_-[$€-2]* \\-#,##0.00_-;_-[$€-2]* "-"??_-;_-@';
const NAVY = "FF002060";
const GRAY = "FFBFBFBF";
const YELLOW = "FFFFFF00";

// Reproduces the existing hand-built "Bilancino" Excel template exactly —
// same layout, colors, and formulas (see supabase/migration_026 for how the
// underlying cost_items/deals data is scoped) — so a sheet exported from
// HubConnect can be edited in Excel afterward and still recalculate.
export async function GET(request) {
  const url = new URL(request.url);
  const eventId = url.searchParams.get("event");
  const leadFileId = url.searchParams.get("leadFile");
  if (!eventId && !leadFileId) return new Response("event or leadFile required", { status: 400 });

  const { supabase } = await requireProfile();

  const [scopeResult, itemsResult, revenueItemsResult, dealsResult] = await Promise.all([
    eventId
      ? supabase.from("events").select("name").eq("id", eventId).single()
      : supabase.from("lead_files").select("name").eq("id", leadFileId).single(),
    supabase
      .from("cost_items")
      .select("description, imponibile, iva")
      .eq(eventId ? "event_id" : "lead_file_id", eventId || leadFileId)
      .order("created_at", { ascending: true }),
    supabase
      .from("revenue_items")
      .select("description, imponibile, iva")
      .eq(eventId ? "event_id" : "lead_file_id", eventId || leadFileId)
      .order("created_at", { ascending: true }),
    eventId
      ? supabase.from("deals").select("company_name, offer_value, iva, company:companies(name)").eq("stage", "won").or(`pushed_event_id.eq.${eventId},event_id.eq.${eventId}`)
      : supabase.from("deals").select("company_name, offer_value, iva, company:companies(name)").eq("stage", "won").eq("lead_file_id", leadFileId),
  ]);

  const scopeName = scopeResult.data?.name || "Bilancino";
  const costs = itemsResult.data || [];
  // deal.iva is whatever VAT rate/amount was actually chosen for that lead
  // when it was won (see app/(app)/leads/actions.js) — written as a literal
  // value, same as manual rows, not a fixed-rate formula.
  const revenues = [
    ...(dealsResult.data || []).map((deal) => ({ name: deal.company?.name || deal.company_name || "—", imponibile: Number(deal.offer_value || 0), iva: Number(deal.iva || 0) })),
    ...(revenueItemsResult.data || []).map((item) => ({ name: item.description, imponibile: Number(item.imponibile || 0), iva: Number(item.iva || 0) })),
  ];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HubConnect";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Bilancino");
  sheet.columns = [
    { width: 42 }, { width: 14 }, { width: 12 }, { width: 16 }, { width: 3 },
    { width: 24 }, { width: 14 }, { width: 12 }, { width: 16 }, { width: 12 },
  ];

  sheet.mergeCells("A3:I3");
  const titleCell = sheet.getCell("A3");
  titleCell.value = scopeName;
  titleCell.font = { name: "Helvetica Neue", size: 11, bold: true };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRAY } };

  sheet.mergeCells("A4:D4");
  const costiHeader = sheet.getCell("A4");
  costiHeader.value = "COSTI";
  costiHeader.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  costiHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };

  sheet.mergeCells("F4:I4");
  const ricaviHeader = sheet.getCell("F4");
  ricaviHeader.value = "RICAVI";
  ricaviHeader.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  ricaviHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };

  const columnHeaders = { B5: "IMPONIBILE", C5: "IVA", D5: "TOTALE CON IVA", G5: "IMPONIBILE", H5: "IVA", I5: "TOTALE CON IVA", J5: "status" };
  for (const [address, label] of Object.entries(columnHeaders)) {
    const cell = sheet.getCell(address);
    cell.value = label;
    cell.font = { name: "Calibri", size: 11, bold: true };
  }

  const dataStartRow = 6;
  const rowCount = Math.max(costs.length, revenues.length, 1);

  costs.forEach((item, index) => {
    const row = dataStartRow + index;
    sheet.getCell(`A${row}`).value = item.description;
    sheet.getCell(`B${row}`).value = Number(item.imponibile || 0);
    sheet.getCell(`C${row}`).value = Number(item.iva || 0);
    sheet.getCell(`D${row}`).value = { formula: `SUM(B${row},C${row})` };
    for (const col of ["B", "C", "D"]) sheet.getCell(`${col}${row}`).numFmt = EUR_FORMAT;
  });

  revenues.forEach((row_, index) => {
    const row = dataStartRow + index;
    sheet.getCell(`F${row}`).value = row_.name;
    sheet.getCell(`G${row}`).value = row_.imponibile;
    sheet.getCell(`H${row}`).value = row_.iva;
    sheet.getCell(`I${row}`).value = { formula: `SUM(G${row},H${row})` };
    for (const col of ["G", "H", "I"]) sheet.getCell(`${col}${row}`).numFmt = EUR_FORMAT;
  });

  const costEndRow = dataStartRow + Math.max(costs.length, 1) - 1;
  const revenueEndRow = dataStartRow + Math.max(revenues.length, 1) - 1;
  const totalRicaviRow = dataStartRow + rowCount + 2;
  const totalCostiRow = totalRicaviRow + 2;
  const utileNettoRow = totalCostiRow + 2;
  const marginRow = utileNettoRow + 1;

  sheet.getCell(`F${totalRicaviRow}`).value = "TOTALE RICAVI";
  sheet.getCell(`F${totalRicaviRow}`).font = { name: "Calibri", size: 12, bold: true };
  for (const col of ["G", "H", "I"]) {
    const cell = sheet.getCell(`${col}${totalRicaviRow}`);
    cell.value = { formula: `SUM(${col}${dataStartRow}:${col}${revenueEndRow})` };
    cell.numFmt = EUR_FORMAT;
    cell.font = { name: "Calibri", size: 12, bold: true };
  }

  sheet.getCell(`A${totalCostiRow}`).value = "TOTALE COSTI";
  sheet.getCell(`A${totalCostiRow}`).font = { name: "Calibri", size: 12, bold: true };
  for (const col of ["B", "C", "D"]) {
    const cell = sheet.getCell(`${col}${totalCostiRow}`);
    cell.value = { formula: `SUM(${col}${dataStartRow}:${col}${costEndRow})` };
    cell.numFmt = EUR_FORMAT;
    cell.font = { name: "Calibri", size: 12, bold: true };
  }

  const utileCell = sheet.getCell(`A${utileNettoRow}`);
  utileCell.value = "UTILE NETTO";
  utileCell.font = { name: "Arial", size: 12, bold: true };
  utileCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } };
  const utileValueCell = sheet.getCell(`B${utileNettoRow}`);
  utileValueCell.value = { formula: `+G${totalRicaviRow}-B${totalCostiRow}` };
  utileValueCell.numFmt = "#,##0;(#,##0)";
  utileValueCell.font = { name: "Arial", size: 12, bold: true };
  utileValueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } };

  const marginLabelCell = sheet.getCell(`A${marginRow}`);
  marginLabelCell.value = "% sui Ricavi";
  marginLabelCell.font = { name: "Arial", size: 11, bold: true };
  marginLabelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } };
  const marginValueCell = sheet.getCell(`B${marginRow}`);
  marginValueCell.value = { formula: `IFERROR(B${utileNettoRow}/G${totalRicaviRow},0)` };
  marginValueCell.numFmt = "0.0%";
  marginValueCell.font = { name: "Arial", size: 11, bold: true };
  marginValueCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW } };

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `Bilancino_${scopeName.replace(/[^a-zA-Z0-9._-]/g, "_")}.xlsx`;
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
