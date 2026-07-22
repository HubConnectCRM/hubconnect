import ExcelJS from "exceljs";

export async function workbookResponse(filename, sheets) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "HubConnect";
  workbook.created = new Date();
  for (const sheetData of sheets) {
    const sheet = workbook.addWorksheet(sheetData.name.slice(0, 31));
    sheet.columns = sheetData.columns.map((column) => ({ header: column.header, key: column.key, width: column.width || 20 }));
    sheet.addRows(sheetData.rows.map((row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, value === "" ? null : value]),
    )));
    sheet.views = [{ state: "frozen", ySplit: 1, xSplit: sheetData.freezeColumns || 0 }];
    if (sheetData.autoFilter !== false) sheet.autoFilter = { from: "A1", to: `${columnLetter(sheetData.columns.length)}1` };
    sheet.properties.defaultRowHeight = 20;
    sheet.pageSetup = {
      orientation: sheetData.orientation || "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    };
    const header = sheet.getRow(1);
    header.height = 34;
    for (let columnIndex = 1; columnIndex <= sheetData.columns.length; columnIndex += 1) {
      const cell = header.getCell(columnIndex);
      cell.font = { bold: true, color: { argb: "FF11130F" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9FA84" } };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: "FFB8D45F" } } };
    }
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const rowData = sheetData.rows[rowNumber - 2] || {};
        const rowFill = sheetData.rowFill?.(rowData) || null;
        for (let columnIndex = 1; columnIndex <= sheetData.columns.length; columnIndex += 1) {
          const cell = row.getCell(columnIndex);
          cell.alignment = { vertical: "top", horizontal: sheetData.columns[columnIndex - 1]?.align || "left", wrapText: true };
          const key = sheetData.columns[columnIndex - 1]?.key;
          const cellFill = sheetData.cellFill?.(rowData, key) || rowFill || (rowNumber % 2 === 0 ? "FFF4F6EF" : null);
          if (cellFill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: cellFill } };
        }
        if (sheetData.rowHeight) row.height = sheetData.rowHeight;
      }
    });
    if (sheetData.name === "Event Summary" || sheetData.name === "Riepilogo") {
      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) sheet.getCell(`A${rowNumber}`).font = { bold: true, color: { argb: "FF31352C" } };
    }
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`, "Cache-Control": "no-store" } });
}

function columnLetter(count) {
  let result = "";
  for (let number = count; number > 0; number = Math.floor((number - 1) / 26)) result = String.fromCharCode(65 + ((number - 1) % 26)) + result;
  return result;
}
