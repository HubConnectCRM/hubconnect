"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

function cellToString(v) {
  if (v == null) return "";
  if (typeof v === "object") {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (v.text != null) return String(v.text);
    if (v.result != null) return String(v.result);
    if (v.richText) return v.richText.map((r) => r.text).join("");
    if (v.hyperlink) return String(v.hyperlink);
    return "";
  }
  return String(v).trim();
}

// Parse an uploaded .xlsx (base64) and return each sheet's rows (capped).
export async function parseWorkbook(base64) {
  await requireProfile();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(base64, "base64"));

  const sheets = wb.worksheets.map((ws) => {
    const rows = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (rows.length >= 2000) return;
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(values.map(cellToString));
    });
    return { name: ws.name, rows };
  });

  return { sheets };
}

function clean(v) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

// rows: array of objects keyed by import field (first_name, email, company, …)
export async function importContacts(rows) {
  const { supabase, user } = await requireProfile();
  if (!Array.isArray(rows) || rows.length === 0) return { inserted: 0, skipped: 0 };

  // Existing emails for dedup
  const { data: existing } = await supabase
    .from("contacts")
    .select("email_normalized")
    .not("email_normalized", "is", null)
    .limit(20000);
  const seen = new Set((existing || []).map((c) => c.email_normalized));

  // Company name -> id cache (find or create)
  const companyCache = new Map();
  async function resolveCompany(name) {
    const c = clean(name);
    if (!c) return null;
    const key = c.toLowerCase();
    if (companyCache.has(key)) return companyCache.get(key);
    const { data: found } = await supabase
      .from("companies")
      .select("id")
      .eq("name_normalized", key)
      .limit(1)
      .maybeSingle();
    let id = found?.id;
    if (!id) {
      const { data: created } = await supabase
        .from("companies")
        .insert({ name: c, created_by: user.id })
        .select("id")
        .single();
      id = created?.id ?? null;
    }
    companyCache.set(key, id);
    return id;
  }

  let inserted = 0;
  let skipped = 0;
  const toInsert = [];

  for (const r of rows) {
    let first = clean(r.first_name);
    let last = clean(r.last_name);
    const full = clean(r.full_name);
    if (!first && !last && full) {
      const parts = full.split(/\s+/);
      first = parts.shift();
      last = parts.join(" ") || null;
    }
    if (!first && !last) continue;

    const email = clean(r.email);
    const emailNorm = email ? email.toLowerCase() : null;
    if (emailNorm && seen.has(emailNorm)) {
      skipped++;
      continue;
    }
    if (emailNorm) seen.add(emailNorm);

    const companyId = await resolveCompany(r.company);
    toInsert.push({
      first_name: first,
      last_name: last,
      job_title: clean(r.job_title),
      email,
      phone: clean(r.phone),
      company_id: companyId,
      country: clean(r.country),
      city: clean(r.city),
      source: clean(r.source),
      notes: clean(r.notes),
      created_by: user.id,
    });
  }

  // Insert in batches of 200
  for (let i = 0; i < toInsert.length; i += 200) {
    const batch = toInsert.slice(i, i + 200);
    const { error } = await supabase.from("contacts").insert(batch);
    if (error) return { inserted, skipped, error: error.message };
    inserted += batch.length;
  }

  revalidatePath("/contacts");
  return { inserted, skipped };
}
