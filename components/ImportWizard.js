"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { parseWorkbook, importContacts } from "@/app/(app)/import/actions";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Checkbox } from "@/components/ui";
import { IMPORT_FIELDS } from "@/lib/constants";

const FIELD_LABELS = {
  owner: "Responsible / internal owner",
  response_date: "Response mail date",
  final_decision: "Final decision / trattamento",
  event: "Event",
  first_name: "First name",
  last_name: "Last name",
  full_name: "Full name",
  job_title: "Job title",
  email: "Email",
  phone: "Phone",
  company: "Company",
  country: "Country",
  city: "City",
  source: "Source",
  notes: "Notes",
  linkedin: "LinkedIn",
  topic: "Topic / theme",
  last_contact: "Last contact",
  last_action: "Last action / feedback",
  next_step: "Next step",
  rsvp: "RSVP / yes-no",
  gdpr_consent: "GDPR consent",
  hub_consent: "Hub data consent",
  partner_consent: "Partner data consent",
};

const EXTENDED_FIELDS = Array.from(new Set([...IMPORT_FIELDS, "owner", "response_date", "final_decision", "event", "topic", "last_contact", "last_action", "next_step", "rsvp", "hub_consent", "partner_consent", "gdpr_consent", "linkedin", "website"]));

const EXACT = {
  company: ["company", "company name", "client", "clients", "cliente", "azienda", "account", "brand"],
  full_name: ["contact", "contact name", "contatto", "nominativo", "person", "person name", "nome completo"],
  first_name: ["first", "first name", "nome", "ad", "given name"],
  last_name: ["last", "last name", "cognome", "soyad", "surname"],
  job_title: ["job", "job title", "jobtitle", "ruolo", "unvan", "ünvan", "position", "role", "titolo"],
  email: ["email", "mail", "e-mail", "e posta", "e-posta"],
  phone: ["phone", "tel", "telephone", "telefono", "mobile", "cell", "cellulare"],
  owner: ["owner", "responsabile", "referente", "sales", "current account", "team leader", "assegnato", "account manager"],
  event: ["event", "evento", "service", "area di business"],
  topic: ["topic", "tema", "attività", "attivita", "area", "service"],
  response_date: ["risposta mail", "data risposta", "response date", "mail response", "last mail"],
  last_contact: ["last contact", "ultimo contatto", "ultima data"],
  last_action: ["last action", "ultima azioni", "ultima azione", "feedback", "action", "azione"],
  next_step: ["next step", "next", "follow up", "prossimo step"],
  rsvp: ["si/no", "sì/no", "yes/no", "rsvp", "confirmed", "confermato", "da invitare", "attendance", "presenza", "presence"],
  final_decision: ["trattamento", "decisione finale", "final decision", "esito", "attendance final"],
  gdpr_consent: ["gdpr", "privacy", "trattamento dati", "consenso privacy"],
  hub_consent: ["trattamento dati hub", "hub consent", "consenso hub"],
  partner_consent: ["trattamento dati partner", "partner consent", "consenso partner"],
  country: ["country", "paese", "ülke", "ulke", "nation"],
  city: ["city", "città", "citta", "şehir", "sehir"],
  source: ["source", "origin", "kaynak", "list", "provenienza"],
  notes: ["note", "notes", "comment", "commenti", "overview", "ovwerview", "description"],
  linkedin: ["linkedin", "linked in"],
  website: ["website", "site", "sito", "web", "domain"],
};

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const norm = (v) => clean(v).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const isEmail = (v) => /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(String(v || ""));
const extractEmail = (v) => String(v || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
const isPhone = (v) => {
  const s = String(v || "").trim();
  const digits = s.replace(/[^\d]/g, "");
  return digits.length >= 7 && /^[+()\-\s\d./]+$/.test(s);
};
const ratio = (samples, fn) => (samples.length ? samples.filter(fn).length / samples.length : 0);

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let quote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { quote = !quote; continue; }
    if ((ch === "," || ch === ";") && !quote) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map(clean);
}

function parseCsv(text, name = "CSV") {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => splitCsvLine(l)).filter((r) => r.some(Boolean));
  return [{ name, rows }];
}

function headerHits(row) {
  const cells = (row || []).map(norm).filter(Boolean);
  return cells.reduce((sum, c) => sum + (Object.values(EXACT).some((list) => list.some((kw) => c === norm(kw) || c.includes(norm(kw)))) ? 1 : 0), 0);
}

function scoreHeaderCandidate(row, nextRows) {
  const cells = (row || []).map(clean).filter(Boolean);
  if (cells.length < 2) return 0;
  const low = cells.map(norm);
  let score = Math.min(cells.length, 12) + headerHits(row) * 7;
  const samples = nextRows.flat().map(clean).filter(Boolean).slice(0, 300);
  if (samples.some(isEmail)) score += 8;
  if (samples.some(isPhone)) score += 3;
  if (new Set(low).size === low.length) score += 2;
  if (low.includes("company") || low.includes("company name") || low.includes("client")) score += 4;
  if (low.includes("email") || low.includes("mail")) score += 5;
  return score;
}

function detectHeaderRow(rows) {
  let best = 0;
  let bestScore = -1;
  rows.slice(0, 20).forEach((row, idx) => {
    const score = scoreHeaderCandidate(row, rows.slice(idx + 1, idx + 35));
    if (score > bestScore) { best = idx; bestScore = score; }
  });
  return best + 1;
}

function scoreSheet(sheet) {
  const rows = sheet.rows || [];
  const h = detectHeaderRow(rows);
  const dataScore = Math.min(rows.filter((r) => r.some(Boolean)).length / 10, 30);
  return scoreHeaderCandidate(rows[h - 1] || [], rows.slice(h, h + 60)) + dataScore;
}

function matchHeaderToField(header, used) {
  const h = norm(header);
  if (!h) return { field: "", score: 0 };
  const priority = ["email", "phone", "company", "first_name", "last_name", "full_name", "job_title", "response_date", "final_decision", "rsvp", "event", "owner", "topic", "last_contact", "last_action", "next_step", "hub_consent", "partner_consent", "gdpr_consent", "country", "city", "source", "linkedin", "website", "notes"];
  let best = { field: "", score: 0 };
  for (const field of priority) {
    if (used.has(field) && !["notes", "topic"].includes(field)) continue;
    for (const kw of EXACT[field] || []) {
      const k = norm(kw);
      let score = 0;
      if (h === k) score = 98;
      else if (h.includes(k) || k.includes(h)) score = Math.min(92, 62 + k.length * 4);
      if (score > best.score) best = { field, score };
    }
  }
  // Do not let a generic "Name" become a person when the header is actually "Company Name".
  if (h.includes("company") && best.field === "full_name") return { field: "company", score: 94 };
  return best.score >= 60 ? best : { field: "", score: 0 };
}

function guessMapping(headers, rows) {
  const mapping = Array(headers.length).fill("");
  const confidence = Array(headers.length).fill(0);
  const used = new Set();
  const samples = headers.map((_, i) =>
    (rows || []).map((r) => r[i]).filter((v) => clean(v)).map(clean).slice(0, 120)
  );

  // Value-pattern first for email/phone, because many sheets use weird labels like "Mail".
  let bestEmail = -1, bestEmailR = 0;
  samples.forEach((s, i) => { const r = ratio(s, isEmail); if (r > bestEmailR) { bestEmailR = r; bestEmail = i; } });
  if (bestEmail >= 0 && bestEmailR >= 0.22) { mapping[bestEmail] = "email"; confidence[bestEmail] = Math.round(bestEmailR * 100); used.add("email"); }

  let bestPhone = -1, bestPhoneR = 0;
  samples.forEach((s, i) => { if (mapping[i]) return; const r = ratio(s, isPhone); if (r > bestPhoneR) { bestPhoneR = r; bestPhone = i; } });
  if (bestPhone >= 0 && bestPhoneR >= 0.40) { mapping[bestPhone] = "phone"; confidence[bestPhone] = Math.round(bestPhoneR * 100); used.add("phone"); }

  let bestOwner = -1, bestOwnerR = 0;
  samples.forEach((s, i) => {
    if (mapping[i]) return;
    const r = ratio(s, (v) => /^s[iì]\s+[a-z]/i.test(clean(v)) || /^yes\s+[a-z]/i.test(clean(v)));
    if (r > bestOwnerR) { bestOwnerR = r; bestOwner = i; }
  });
  if (bestOwner >= 0 && bestOwnerR >= 0.30) { mapping[bestOwner] = "owner"; confidence[bestOwner] = Math.round(bestOwnerR * 100); used.add("owner"); }

  headers.forEach((h, i) => {
    if (mapping[i]) return;
    const match = matchHeaderToField(h, used);
    mapping[i] = match.field;
    confidence[i] = match.score;
    if (match.field && !["notes", "topic"].includes(match.field)) used.add(match.field);
  });

  // Safety: if no company was found but a header says Client/Company Name, force it.
  headers.forEach((h, i) => {
    const x = norm(h);
    if ((x === "company name" || x === "company" || x === "client" || x === "azienda") && mapping[i] !== "company") {
      const old = mapping.indexOf("company");
      if (old >= 0) { mapping[old] = ""; confidence[old] = 0; }
      mapping[i] = "company"; confidence[i] = 98;
    }
  });
  return { mapping, confidence };
}

function classifyWorkbook(fileName, sheets) {
  const file = norm(fileName);
  const allText = norm((sheets || []).map((s) => `${s.name} ${(s.rows || []).slice(0, 8).flat().join(" ")}`).join(" "));
  const eventScore = ["iscrizioni", "iscritti", "beauty connect", "si/no", "trattamento dati", "telephone", "waiting list"].reduce((s, kw) => s + (allText.includes(norm(kw)) || file.includes(norm(kw)) ? 1 : 0), 0);
  const salesScore = ["file sales", "nrf", "prospects", "feedback", "next step", "last action", "owner", "client"].reduce((s, kw) => s + (allText.includes(norm(kw)) || file.includes(norm(kw)) ? 1 : 0), 0);
  if (eventScore >= 2 && eventScore >= salesScore) return "event";
  if (salesScore >= 2) return "sales_pipeline";
  return "contacts";
}

function defaultTargetName(fileName, kind) {
  const base = fileName.replace(/\.(xlsx|csv)$/i, "").replace(/^iscrizioni\s*/i, "").replace(/[-_]+/g, " ").trim();
  if (kind === "event") return base || "Imported Event";
  if (kind === "sales_pipeline") return base || "Imported Sales Leads";
  return "";
}

function mapRowsForSheet(sheet, forcedMapping, forcedHeaderRow) {
  const rows = sheet?.rows || [];
  const headerRow = forcedHeaderRow || detectHeaderRow(rows);
  const headers = rows[headerRow - 1] || [];
  const { mapping } = forcedMapping ? { mapping: forcedMapping } : guessMapping(headers, rows.slice(headerRow));
  return rows.slice(headerRow).map((row) => {
    const obj = { _sheet: sheet.name };
    mapping.forEach((field, i) => {
      if (!field) return;
      const val = clean(row[i]);
      if (!val) return;
      if (field === "email") obj[field] = extractEmail(val) || val;
      else if (obj[field]) obj[field] = `${obj[field]} | ${val}`;
      else obj[field] = val;
    });
    if (!obj.source) obj.source = sheet.name;
    if (!obj.notes) obj.notes = [obj.last_action, obj.next_step].filter(Boolean).join(" | ");
    return obj;
  }).filter((o) => o.first_name || o.last_name || o.full_name || o.email || o.company);
}

export default function ImportWizard({ existingEmails, leadFiles = [], events = [], owners = [], defaultLeadFileId = "", defaultDestination = "", defaultEventId = "" }) {
  const { t } = useTranslation();
  const router = useRouter();
  const emailSet = useMemo(() => new Set(existingEmails), [existingEmails]);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [sheets, setSheets] = useState(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(1);
  const [mapping, setMapping] = useState([]);
  const [confidence, setConfidence] = useState([]);
  const [destination, setDestination] = useState(defaultDestination || (defaultLeadFileId ? "lead_file" : "contacts"));
  const [importAllSheets, setImportAllSheets] = useState(false);
  const [leadFileId, setLeadFileId] = useState(defaultLeadFileId || "");
  const [leadFileName, setLeadFileName] = useState("");
  const [eventId, setEventId] = useState(defaultEventId);
  const [eventName, setEventName] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [createDeals, setCreateDeals] = useState(false);
  const [enrichCompanies, setEnrichCompanies] = useState(true);
  const [result, setResult] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  const sheet = sheets?.[sheetIdx];
  const headers = sheet ? sheet.rows[headerRow - 1] || [] : [];

  function applySheet(idx, hRow) {
    const s = sheets[idx];
    const hdrs = s.rows[hRow - 1] || [];
    const guessed = guessMapping(hdrs, s.rows.slice(hRow));
    setMapping(guessed.mapping);
    setConfidence(guessed.confidence);
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setResult(null);
    setSavedAt(null);
    setFileName(file.name);
    try {
      let parsed;
      if (file.name.toLowerCase().endsWith(".csv")) {
        parsed = parseCsv(await file.text(), file.name);
      } else {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result.toString().split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        parsed = (await parseWorkbook(base64)).sheets;
      }
      const ranked = parsed.map((s, idx) => ({ s, idx, score: scoreSheet(s) })).sort((a, b) => b.score - a.score);
      const bestIdx = ranked[0]?.idx || 0;
      const bestHeader = detectHeaderRow(parsed[bestIdx]?.rows || []);
      const kind = classifyWorkbook(file.name, parsed);
      setSheets(parsed);
      setSheetIdx(bestIdx);
      setHeaderRow(bestHeader);
      const guessed = guessMapping(parsed[bestIdx]?.rows[bestHeader - 1] || [], (parsed[bestIdx]?.rows || []).slice(bestHeader));
      setMapping(guessed.mapping);
      setConfidence(guessed.confidence);
      setDestination(defaultDestination || (kind === "event" ? "event" : kind === "sales_pipeline" ? "sales_pipeline" : "contacts"));
      setImportAllSheets(parsed.length > 1 && (kind === "event" || kind === "sales_pipeline"));
      setCreateDeals(kind === "sales_pipeline");
      const target = defaultTargetName(file.name, kind);
      if (kind === "event") setEventName(target);
      if (kind === "sales_pipeline") setLeadFileName(target);
    } finally {
      setBusy(false);
    }
  }

  const mappedRows = useMemo(() => {
    if (!sheets) return [];
    if (importAllSheets) return sheets.flatMap((s) => mapRowsForSheet(s));
    return mapRowsForSheet(sheet, mapping, headerRow);
  }, [sheets, sheet, mapping, headerRow, importAllSheets]);

  const invalidEmailCount = useMemo(() => mappedRows.filter((o) => o.email && !isEmail(o.email)).length, [mappedRows]);
  const dupeCount = useMemo(() => mappedRows.filter((o) => o.email && emailSet.has(clean(o.email).toLowerCase())).length, [mappedRows, emailSet]);
  const willProcess = mappedRows.length;
  const detectedKind = sheets ? classifyWorkbook(fileName, sheets) : "";

  async function doImport() {
    setBusy(true);
    try {
      const res = await importContacts(mappedRows, {
        destination,
        leadFileId: destination === "lead_file" ? leadFileId : "",
        leadFileName: ["new_lead_file", "sales_pipeline"].includes(destination) ? leadFileName : "",
        eventId: destination === "event" ? eventId : "",
        eventName: destination === "event" ? eventName : "",
        ownerId,
        createDeals: createDeals || destination === "sales_pipeline",
        groupBySheet: importAllSheets,
        enrichCompanies,
      });
      setResult(res);
      setSavedAt(new Date());
      router.refresh();
    } catch (error) {
      setResult({ ok: false, error: error.message || "Import failed", inserted: 0, linked: 0, deals: 0, eventRegistrations: 0, enrichedCompanies: 0 });
      setSavedAt(new Date());
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("import.title")} subtitle="Smart import now detects whether a workbook belongs to Sales, Leads or Events, then routes it to the right workspace." />

      <Card className="mb-4 p-5">
        <Field label={t("import.selectFile")} hint="Supports .xlsx and .csv. Tested for NRF List, FILE SALES, and Beauty Connect registrations. The destination is still editable before import.">
          <input type="file" accept=".xlsx,.csv" onChange={onFile} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--brand)] file:px-3 file:py-2 file:text-white" />
        </Field>
        {busy && !sheets && <p className="mt-3 text-sm text-[var(--muted)]">{t("common.loading")}</p>}
      </Card>

      {sheets && <>
        <Card className="mb-4 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand)]">Detected: {detectedKind === "event" ? "Event registrations" : detectedKind === "sales_pipeline" ? "Sales lead workbook" : "Contacts"}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">Override it here if the guess is wrong. Beauty registrations should go to Events; NRF/File Sales should go to Sales/Leads.</p>
            </div>
            {sheets.length > 1 && <Checkbox checked={importAllSheets} onChange={(e) => setImportAllSheets(e.target.checked)} label={`Import all ${sheets.length} sheets and use sheet names as groups`} />}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Field label={t("import.sheet")}>
              <Select value={sheetIdx} disabled={importAllSheets} onChange={(e) => { const idx = Number(e.target.value); const h = detectHeaderRow(sheets[idx].rows || []); setSheetIdx(idx); setHeaderRow(h); applySheet(idx, h); }}>
                {sheets.map((s, i) => <option key={i} value={i}>{s.name} ({s.rows.length} rows)</option>)}
              </Select>
            </Field>
            <Field label={t("import.headerRow")}>
              <Select value={headerRow} disabled={importAllSheets} onChange={(e) => { const h = Number(e.target.value); setHeaderRow(h); applySheet(sheetIdx, h); }}>
                {sheet.rows.slice(0, 20).map((_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
              </Select>
            </Field>
            <Field label="Import into">
              <Select value={destination} onChange={(e) => setDestination(e.target.value)}>
                <option value="contacts">Contacts only</option>
                <option value="lead_file">Existing lead file</option>
                <option value="new_lead_file">New lead file</option>
                <option value="sales_pipeline">Sales pipeline + lead file</option>
                <option value="event">Event registrations</option>
              </Select>
            </Field>
            <Field label="Owner / default sales rep">
              <Select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                <option value="">Me / from sheet</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{o.full_name || o.email}</option>)}
              </Select>
            </Field>
            {destination === "lead_file" && <Field label="Lead file" className="md:col-span-2"><Select value={leadFileId} onChange={(e) => setLeadFileId(e.target.value)}>{leadFiles.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select></Field>}
            {["new_lead_file", "sales_pipeline"].includes(destination) && <Field label="Lead file name" className="md:col-span-2"><Input value={leadFileName} onChange={(e) => setLeadFileName(e.target.value)} placeholder="NRF Paris / FILE SALES" /></Field>}
            {destination === "event" && <Field label="Existing event" className="md:col-span-2"><Select value={eventId} onChange={(e) => setEventId(e.target.value)}><option value="">Create / use name below</option>{events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}</Select></Field>}
            {destination === "event" && !eventId && <Field label="Event name" className="md:col-span-2"><Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Beauty Connect 2026 - I chapter" /></Field>}
            {destination !== "contacts" && destination !== "event" && <div className="flex items-end"><Checkbox checked={createDeals} onChange={(e) => setCreateDeals(e.target.checked)} label="Create a sales opportunity per company" /></div>}
            <div className="flex items-end md:col-span-2"><Checkbox checked={enrichCompanies} onChange={(e) => setEnrichCompanies(e.target.checked)} label="Auto-build company cache from website/email domain after import" /></div>
          </div>
        </Card>

        {!importAllSheets && <Card className="mb-4 p-5">
          <h2 className="mb-3 text-sm font-semibold text-[var(--muted)]">Smart column mapping</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {headers.map((h, i) => <div key={i} className="rounded-xl border border-[var(--border)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium" title={h}>{h || `#${i + 1}`}</p>
                {mapping[i] && <Badge color={confidence[i] >= 85 ? "green" : confidence[i] >= 70 ? "amber" : "gray"}>{confidence[i]}%</Badge>}
              </div>
              <Select value={mapping[i] || ""} onChange={(e) => { const next = [...mapping]; next[i] = e.target.value; setMapping(next); }}>
                <option value="">{t("import.ignore")}</option>
                {EXTENDED_FIELDS.map((f) => <option key={f} value={f}>{FIELD_LABELS[f] || f.replaceAll("_", " ")}</option>)}
              </Select>
            </div>)}
          </div>
        </Card>}

        <Card className="mb-4 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-[var(--muted)]">Preview</h2>
            <p className="text-sm"><span className="font-medium text-[var(--brand)]">{willProcess}</span> rows · {dupeCount} duplicates · {invalidEmailCount} invalid emails</p>
          </div>
          {mappedRows.length === 0 ? <EmptyState>{t("common.noResults")}</EmptyState> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-[var(--border)] text-left text-[var(--muted)]"><tr>{["_sheet", "owner", "response_date", "company", "full_name", "first_name", "last_name", "job_title", "email", "phone", "rsvp", "final_decision", "notes"].filter((f) => f === "_sheet" ? importAllSheets : mappedRows.some((r) => r[f])).map((f) => <th key={f} className="px-2 py-2 font-medium">{f.replaceAll("_", " ")}</th>)}<th className="px-2 py-2 font-medium">Status</th></tr></thead><tbody>{mappedRows.slice(0, 14).map((o, i) => <tr key={i} className="border-b border-[var(--border)] last:border-0">{["_sheet", "owner", "response_date", "company", "full_name", "first_name", "last_name", "job_title", "email", "phone", "rsvp", "final_decision", "notes"].filter((f) => f === "_sheet" ? importAllSheets : mappedRows.some((r) => r[f])).map((f) => <td key={f} className="px-2 py-2 text-[var(--muted)]">{o[f] || "—"}</td>)}<td className="px-2 py-2">{o.email && !isEmail(o.email) ? <Badge color="red">Invalid email</Badge> : o.email && emailSet.has(clean(o.email).toLowerCase()) ? <Badge color="amber">Duplicate/update</Badge> : <Badge color="green">New</Badge>}</td></tr>)}</tbody></table></div>}
        </Card>

        <div className="flex items-center justify-end gap-3">
          {result && <p className={"text-sm " + (result.ok === false ? "text-red-700" : "text-green-700")}>{result.ok === false ? <>Import stopped: {result.error}</> : <>Saved. Inserted {result.inserted}, updated {result.skipped}, linked {result.linked}, deals {result.deals}, event registrations {result.eventRegistrations || 0}, company caches {result.enrichedCompanies || 0}.{savedAt ? ` ${savedAt.toLocaleTimeString()}` : ""}</>}</p>}
          <Button onClick={doImport} disabled={busy || willProcess === 0 || (destination === "lead_file" && !leadFileId) || (["new_lead_file", "sales_pipeline"].includes(destination) && !leadFileName.trim()) || (destination === "event" && !eventId && !eventName.trim())}>{busy ? "Importing..." : result?.ok ? "Saved ✓ Import again" : t("import.import")}</Button>
        </div>
      </>}
    </div>
  );
}
