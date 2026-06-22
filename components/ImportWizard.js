"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { parseWorkbook, importContacts } from "@/app/(app)/import/actions";
import { Button, Card, EmptyState, Field, PageHeader, Select } from "@/components/ui";
import { IMPORT_FIELDS } from "@/lib/constants";

const GUESS = {
  first_name: ["first", "nome", "ad", "given"],
  last_name: ["last", "cognome", "soyad", "surname"],
  full_name: ["contact", "contatto", "name", "referente", "nominativo"],
  job_title: ["job", "title", "ruolo", "ünvan", "unvan", "position"],
  email: ["email", "mail", "e-posta", "eposta"],
  phone: ["phone", "tel", "telefono", "telephone", "telefon"],
  company: ["company", "client", "cliente", "azienda", "şirket", "sirket", "account"],
  country: ["country", "paese", "ülke", "ulke", "nation"],
  city: ["city", "città", "citta", "şehir", "sehir"],
  source: ["source", "event", "evento", "origin", "kaynak", "list"],
  notes: ["note", "notes", "azioni", "feedback", "topic", "tema"],
};

function guessMapping(headers) {
  const used = new Set();
  return headers.map((h) => {
    const text = (h || "").toString().toLowerCase();
    for (const field of IMPORT_FIELDS) {
      if (used.has(field)) continue;
      if ((GUESS[field] || []).some((kw) => text.includes(kw))) {
        used.add(field);
        return field;
      }
    }
    return "";
  });
}

export default function ImportWizard({ existingEmails }) {
  const { t } = useTranslation();
  const emailSet = useMemo(() => new Set(existingEmails), [existingEmails]);

  const [busy, setBusy] = useState(false);
  const [sheets, setSheets] = useState(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(1);
  const [mapping, setMapping] = useState([]);
  const [result, setResult] = useState(null);

  const sheet = sheets?.[sheetIdx];
  const headers = sheet ? sheet.rows[headerRow - 1] || [] : [];
  const dataRows = sheet ? sheet.rows.slice(headerRow) : [];

  function applySheet(idx, hRow) {
    const s = sheets[idx];
    const hdrs = s.rows[hRow - 1] || [];
    setMapping(guessMapping(hdrs));
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.toString().split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { sheets: parsed } = await parseWorkbook(base64);
      setSheets(parsed);
      setSheetIdx(0);
      setHeaderRow(1);
      setMapping(guessMapping(parsed[0]?.rows[0] || []));
    } finally {
      setBusy(false);
    }
  }

  const mappedRows = useMemo(() => {
    return dataRows
      .map((row) => {
        const obj = {};
        mapping.forEach((field, i) => {
          if (field) obj[field] = row[i];
        });
        return obj;
      })
      .filter((o) => o.first_name || o.last_name || o.full_name);
  }, [dataRows, mapping]);

  const dupeCount = useMemo(
    () =>
      mappedRows.filter(
        (o) => o.email && emailSet.has(o.email.toString().trim().toLowerCase())
      ).length,
    [mappedRows, emailSet]
  );

  const willImport = mappedRows.length - dupeCount;

  async function doImport() {
    setBusy(true);
    try {
      const res = await importContacts(mappedRows);
      setResult(res);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("import.title")} subtitle={t("import.intro")} />

      <Card className="mb-4 p-5">
        <Field label={t("import.selectFile")}>
          <input
            type="file"
            accept=".xlsx"
            onChange={onFile}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--brand)] file:px-3 file:py-2 file:text-white"
          />
        </Field>
        {busy && !sheets && <p className="mt-3 text-sm text-[var(--muted)]">{t("common.loading")}</p>}
      </Card>

      {sheets && (
        <>
          <Card className="mb-4 grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <Field label={t("import.sheet")}>
              <Select
                value={sheetIdx}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setSheetIdx(idx);
                  setHeaderRow(1);
                  applySheet(idx, 1);
                }}
              >
                {sheets.map((s, i) => (
                  <option key={i} value={i}>
                    {s.name} ({Math.max(s.rows.length - 1, 0)} {t("import.rows")})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("import.headerRow")}>
              <Select
                value={headerRow}
                onChange={(e) => {
                  const h = Number(e.target.value);
                  setHeaderRow(h);
                  applySheet(sheetIdx, h);
                }}
              >
                {sheet.rows.slice(0, 10).map((_, i) => (
                  <option key={i} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </Select>
            </Field>
          </Card>

          <Card className="mb-4 p-5">
            <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">
              {t("import.step3")}
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {headers.map((h, i) => (
                <div key={i} className="rounded-lg border border-[var(--border)] p-2">
                  <p className="mb-1 truncate text-xs font-medium" title={h}>
                    {h || `#${i + 1}`}
                  </p>
                  <Select
                    value={mapping[i] || ""}
                    onChange={(e) => {
                      const next = [...mapping];
                      next[i] = e.target.value;
                      setMapping(next);
                    }}
                  >
                    <option value="">{t("import.ignore")}</option>
                    {IMPORT_FIELDS.map((f) => (
                      <option key={f} value={f}>
                        {t(`import.fields.${f}`)}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </Card>

          <Card className="mb-4 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--muted)]">
                {t("import.previewRows")}
              </h2>
              <p className="text-sm">
                <span className="font-medium text-[var(--brand)]">{willImport}</span>{" "}
                {t("import.willImport")} · {dupeCount} {t("import.duplicates")}
              </p>
            </div>
            {mappedRows.length === 0 ? (
              <EmptyState>{t("common.noResults")}</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                    <tr>
                      {IMPORT_FIELDS.filter((f) => mapping.includes(f) && f !== "notes").map(
                        (f) => (
                          <th key={f} className="px-2 py-2 font-medium">
                            {t(`import.fields.${f}`)}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {mappedRows.slice(0, 8).map((o, i) => (
                      <tr key={i} className="border-b border-[var(--border)] last:border-0">
                        {IMPORT_FIELDS.filter(
                          (f) => mapping.includes(f) && f !== "notes"
                        ).map((f) => (
                          <td key={f} className="px-2 py-2 text-[var(--muted)]">
                            {o[f] || "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <div className="flex items-center justify-end gap-3">
            {result && (
              <p className="text-sm text-green-700">
                {t("import.done", {
                  count: result.inserted,
                  skipped: result.skipped,
                })}
              </p>
            )}
            <Button onClick={doImport} disabled={busy || willImport <= 0}>
              {busy
                ? t("import.importing")
                : t("import.importButton", { count: willImport })}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
