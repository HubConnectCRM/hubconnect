"use server";

import ExcelJS from "exceljs";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

const COMPANY_ENRICH_LIMIT = 80;
const FETCH_TIMEOUT_MS = 2200;

function cellToString(v) {
  if (v == null) return "";
  if (typeof v === "object") {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (v.text != null) return String(v.text).trim();
    if (v.result != null) return String(v.result).trim();
    if (v.richText) return v.richText.map((r) => r.text).join("").trim();
    if (v.hyperlink) return String(v.hyperlink).trim();
    return "";
  }
  return String(v).trim();
}

export async function parseWorkbook(base64) {
  await requireProfile();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(base64, "base64"));

  const sheets = wb.worksheets.map((ws) => {
    const rows = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      if (rows.length >= 8000) return;
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      rows.push(values.map(cellToString));
    });
    return { name: ws.name, rows };
  });

  return { sheets };
}

function clean(v) {
  const s = (v ?? "").toString().replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

function norm(v) {
  return (clean(v) || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function emailClean(v) {
  const raw = clean(v);
  if (!raw) return null;
  return raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || raw;
}

function domainFromEmail(v) {
  const email = emailClean(v);
  const domain = email?.split("@")[1]?.toLowerCase();
  if (!domain || ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com", "live.com"].includes(domain)) return null;
  return domain;
}

function normalizeUrl(v) {
  const raw = clean(v);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw)) return `https://${raw}`;
  return null;
}

function slugifyCompany(name) {
  return norm(name).replace(/\b(srl|sr l|spa|s p a|ltd|limited|inc|gmbh|sas|sa|bv|srls)\b/g, "").replace(/[^a-z0-9]/g, "").slice(0, 36);
}

function isYes(v) {
  return /^(si|sì|yes|y|true|ok|confirmed|confermato|confermata)$/i.test(clean(v) || "");
}

function isNo(v) {
  return /^(no|n|false|declined|rifiutato|rifiutata)$/i.test(clean(v) || "");
}

function normalizeRsvp(...values) {
  const s = norm(values.filter(Boolean).join(" "));
  if (!s) return null;
  if (/\b(no|false|0|declined|non|rifiut|not coming|non viene|non partecipa)\b/.test(s)) return "no";
  if (/\b(maybe|forse|waiting|wait|tentative|lista attesa|da verificare)\b/.test(s)) return "maybe";
  if (/\b(si|yes|true|1|confirmed|conferm|ok|registered|partecipa|viene)\b/.test(s)) return "yes";
  return null;
}

function registrationStatus(raw) {
  const decision = clean(raw.final_decision) || clean(raw.trattamento);
  const rsvp = normalizeRsvp(decision, raw.rsvp);
  const notes = norm([raw.notes, raw.last_action, raw.next_step].filter(Boolean).join(" "));
  if (rsvp === "no") return "declined";
  if (rsvp === "maybe") return "waiting_list";
  if (rsvp === "yes") return "confirmed";
  if (notes.includes("confirmed") || notes.includes("conferm")) return "confirmed";
  if (norm(raw._sheet).includes("iscritt") || norm(raw.source).includes("iscritt")) return "registered";
  return "registered";
}

function participantType(raw) {
  const text = norm([raw.notes, raw.topic, raw.last_action, raw._sheet].filter(Boolean).join(" "));
  if (/\b(speaker|relatore|relatrice)\b/.test(text)) return "speaker";
  if (/\b(riservat|reserved|posto riservato)\b/.test(text)) return "reserved_seat";
  if (/\b(staff|team|crew)\b/.test(text)) return "staff";
  return "guest";
}

function badgeStatus(raw) {
  const text = norm([raw.notes, raw.topic, raw.last_action].filter(Boolean).join(" "));
  if (/\b(no badge|senza badge|badge non necessario)\b/.test(text)) return "no_badge";
  if (/\b(badge missing|missing badge|badge mancante|badge da fare)\b/.test(text)) return "missing";
  return "exists";
}

function splitName(row) {
  let first = clean(row.first_name);
  let last = clean(row.last_name);
  const full = clean(row.full_name);
  if (!first && !last && full) {
    const parts = full.split(/\s+/);
    first = parts.shift() || full;
    last = parts.join(" ") || null;
  }
  return { first, last, full: full || [first, last].filter(Boolean).join(" ") || null };
}

function ownerCandidateText(raw) {
  return clean(raw.owner) || clean(raw.responsible) || clean(raw.referente) || clean(raw.account) || null;
}

function profileAliases(profile) {
  const full = norm(profile.full_name || "");
  const emailLocal = norm((profile.email || "").split("@")[0] || "");
  const parts = full.split(/\s+/).filter(Boolean);
  return Array.from(new Set([full, emailLocal, ...parts].filter((x) => x && x.length >= 3)));
}

function matchOwnerFromText(text, ownerProfiles) {
  const original = clean(text);
  if (!original) return null;
  const x = norm(original)
    .replace(/^(si|sì|yes|ok|da parte di|invitato da|invitata da)\s+/, "")
    .replace(/\b(non chiamare|vedi note|note|da chiamare)\b/g, " ")
    .replace(/[^a-z0-9@._/\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!x || /^(si|sì|yes|ok|no)$/i.test(x)) return null;

  let best = null;
  let bestScore = 0;
  for (const p of ownerProfiles || []) {
    for (const alias of profileAliases(p)) {
      let score = 0;
      if (x === alias) score = 100;
      else if (x.includes(alias)) score = 90;
      else if (alias.includes(x) && x.length >= 4) score = 80;
      if (score > bestScore) { best = p; bestScore = score; }
    }
  }
  return best ? { id: best.id, label: best.full_name || best.email, raw: original } : { id: null, label: original.replace(/^(si|sì|yes)\s+/i, "").trim(), raw: original };
}

function resolveOwnerAssignments(rows, ownerProfiles, fallbackUserId, destination) {
  const assignments = [];
  let lastMatched = null;
  const explicit = rows.map((r) => matchOwnerFromText(ownerCandidateText(r), ownerProfiles));
  const counts = new Map();
  for (const m of explicit) {
    if (m?.id) counts.set(m.id, (counts.get(m.id) || 0) + 1);
  }
  const majorityId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  for (let i = 0; i < rows.length; i++) {
    const rawText = ownerCandidateText(rows[i]);
    const m = explicit[i];
    if (m?.id) { lastMatched = m; assignments[i] = m; continue; }
    // Event files often have "si roberta" only at the top of a colored block and plain "si" below it.
    // For those plain rows, carry the last explicit responsible person down.
    if (destination === "event" && rawText && /^(si|sì|yes|ok)$/i.test(clean(rawText)) && lastMatched?.id) {
      assignments[i] = lastMatched;
      continue;
    }
    if (destination === "event" && !rawText && lastMatched?.id) { assignments[i] = lastMatched; continue; }
    if (m?.label) { assignments[i] = m; continue; }
    if (majorityId && destination === "event") {
      const p = ownerProfiles.find((o) => o.id === majorityId);
      assignments[i] = { id: p?.id, label: p?.full_name || p?.email, raw: "inferred" };
      continue;
    }
    assignments[i] = { id: fallbackUserId, label: null, raw: null };
  }
  return assignments;
}

function ownerIdForIndex(ownerAssignments, index, fallbackUserId, forcedOwnerId) {
  return clean(forcedOwnerId) || ownerAssignments[index]?.id || fallbackUserId;
}

function ownerTextForIndex(ownerAssignments, index) {
  const a = ownerAssignments[index];
  if (!a) return null;
  if (a.label && a.raw && a.raw !== "inferred") return a.label;
  return a.label || null;
}

function meta(html, prop) {
  const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re1 = new RegExp(`<meta[^>]+(?:name|property)=["']${esc}["'][^>]+content=["']([^"']+)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${esc}["']`, "i");
  return html.match(re1)?.[1] || html.match(re2)?.[1] || null;
}

function titleFromHtml(html) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || null;
}

function stripHtml(v) {
  return clean(String(v || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
}

function structuredOverview({ company, website, title, description }) {
  const desc = stripHtml(description || title || "No public website description could be extracted yet.");
  return [
    `Company: ${company}`,
    `What they do: ${desc}`,
    `Products / services: ${desc}`,
    `Target customers: To be verified from outreach context and website signals.`,
    `Geography: To be verified.`,
    `Differentiators: Public website metadata collected automatically; enrich manually if needed.`,
    `Value proposition: ${desc}`,
    `Business model: To be verified.`,
    `Company size: To be verified.`,
    `Notable clients: To be verified.`,
    `Tone: professional`,
    `Website: ${website || "Not found"}`,
  ].join("\n");
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow", headers: { "user-agent": "HubConnect CRM enrichment bot" } });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.includes("text/html")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function enrichOneCompany(companyName, hintDomainOrWebsite) {
  const urlHint = normalizeUrl(hintDomainOrWebsite);
  const domain = !urlHint && hintDomainOrWebsite && /^[\w.-]+\.[a-z]{2,}$/i.test(hintDomainOrWebsite) ? hintDomainOrWebsite : null;
  const candidates = [];
  if (urlHint) candidates.push(urlHint);
  if (domain) candidates.push(`https://${domain}`, `https://www.${domain}`);
  if (!candidates.length) {
    const slug = slugifyCompany(companyName);
    if (slug) candidates.push(`https://${slug}.com`, `https://${slug}.it`);
  }
  for (const url of candidates.slice(0, 3)) {
    const html = await fetchWithTimeout(url);
    if (!html) continue;
    const title = stripHtml(meta(html, "og:title") || titleFromHtml(html));
    const description = stripHtml(meta(html, "description") || meta(html, "og:description"));
    return { website: url, overview: structuredOverview({ company: companyName, website: url, title, description }) };
  }
  return { website: urlHint || (domain ? `https://${domain}` : null), overview: structuredOverview({ company: companyName, website: urlHint || domain, title: null, description: null }) };
}

async function resolveCompanies(supabase, rows, userId) {
  const names = Array.from(new Set(rows.map((r) => clean(r.company)).filter(Boolean)));
  if (!names.length) return new Map();
  const norms = names.map((n) => n.toLowerCase());
  const { data: existing = [] } = await supabase.from("companies").select("id, name, name_normalized, website, overview").in("name_normalized", norms);
  const byNorm = new Map(existing.map((c) => [c.name_normalized, c]));
  const missing = names.filter((n) => !byNorm.has(n.toLowerCase())).map((name) => ({ name, created_by: userId }));
  if (missing.length) {
    const { data: created, error } = await supabase.from("companies").insert(missing).select("id, name, name_normalized, website, overview");
    if (error) throw new Error(error.message);
    (created || []).forEach((c) => byNorm.set(c.name_normalized, c));
  }
  return byNorm;
}

async function enrichCompanies(supabase, companyMap, rows, enabled = true) {
  if (!enabled) return { enriched: 0 };
  const byName = new Map();
  for (const r of rows) {
    const name = clean(r.company);
    if (!name || byName.has(name.toLowerCase())) continue;
    byName.set(name.toLowerCase(), { emailDomain: domainFromEmail(r.email), website: clean(r.website) || clean(r.domain) });
  }
  const candidates = Array.from(companyMap.values())
    .filter((c) => c?.id && (!c.overview || !c.website))
    .slice(0, COMPANY_ENRICH_LIMIT);
  let enriched = 0;
  const chunks = [];
  for (let i = 0; i < candidates.length; i += 8) chunks.push(candidates.slice(i, i + 8));
  for (const chunk of chunks) {
    const results = await Promise.allSettled(chunk.map(async (c) => {
      const hints = byName.get(c.name_normalized) || {};
      const info = await enrichOneCompany(c.name, hints.website || hints.emailDomain);
      const patch = {};
      if (info.website && !c.website) patch.website = info.website;
      if (info.overview && !c.overview) patch.overview = info.overview;
      if (Object.keys(patch).length) {
        await supabase.from("companies").update(patch).eq("id", c.id);
        enriched += 1;
      }
    }));
    void results;
  }
  return { enriched };
}

async function resolveLeadFile(supabase, userId, options) {
  if (!["lead_file", "new_lead_file", "sales_pipeline"].includes(options.destination)) return null;
  if (options.leadFileId) return options.leadFileId;
  const name = clean(options.leadFileName) || `Imported leads ${new Date().toISOString().slice(0, 10)}`;
  const { data: existing } = await supabase.from("lead_files").select("id").eq("name", name).limit(1).maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await supabase.from("lead_files").insert({ name, description: clean(options.description), created_by: userId }).select("id").single();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

async function resolveEvent(supabase, userId, options) {
  if (options.destination !== "event") return null;
  if (options.eventId) return options.eventId;
  const name = clean(options.eventName) || `Imported event ${new Date().toISOString().slice(0, 10)}`;
  const { data: existing } = await supabase.from("events").select("id").eq("name", name).limit(1).maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await supabase.from("events").insert({ name, created_by: userId }).select("id").single();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

async function resolveGroups(supabase, userId, rows, { leadFileId, eventId, groupBySheet }) {
  const names = Array.from(new Set(rows.map((r) => clean(r.group_name) || (groupBySheet ? clean(r._sheet) : null)).filter(Boolean)));
  if (!names.length) return new Map();
  let q = supabase.from("contact_groups").select("id, name").in("name", names);
  q = leadFileId ? q.eq("lead_file_id", leadFileId) : q.eq("event_id", eventId);
  const { data: existing = [] } = await q;
  const byName = new Map(existing.map((g) => [g.name, g.id]));
  const missing = names.filter((n) => !byName.has(n)).map((name) => ({ name, created_by: userId, lead_file_id: leadFileId || null, event_id: eventId || null }));
  if (missing.length) {
    const { data: created, error } = await supabase.from("contact_groups").insert(missing).select("id, name");
    if (error) throw new Error(error.message);
    (created || []).forEach((g) => byName.set(g.name, g.id));
  }
  return byName;
}

function buildNotes(raw) {
  return [clean(raw.notes), clean(raw.last_action), clean(raw.next_step), clean(raw.topic)].filter(Boolean).join(" | ") || null;
}

export async function importContacts(rows, options = {}) {
  const { supabase, user, profile } = await requireProfile();
  const destination = options.destination || "contacts";
  if (destination === "event" && profile.role !== "admin" && profile.role !== "event") return { ok: false, error: "events_read_only" };
  if (["lead_file", "new_lead_file", "sales_pipeline"].includes(destination) && profile.role !== "admin" && profile.role !== "sales") return { ok: false, error: "sales_read_only" };
  if (!Array.isArray(rows) || rows.length === 0) return { ok: true, inserted: 0, skipped: 0, linked: 0, deals: 0, eventRegistrations: 0, enrichedCompanies: 0 };

  try {
    const safeRows = rows.filter((r) => r && (clean(r.email) || clean(r.first_name) || clean(r.last_name) || clean(r.full_name) || clean(r.company))).slice(0, 12000);
    const [{ data: ownerProfiles = [] }, companyMap, leadFileId, eventId] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email"),
      resolveCompanies(supabase, safeRows, user.id),
      resolveLeadFile(supabase, user.id, options),
      resolveEvent(supabase, user.id, options),
    ]);

    const ownerAssignments = resolveOwnerAssignments(safeRows, ownerProfiles, user.id, options.destination);

    const emailRows = safeRows.map((r) => emailClean(r.email)).filter(Boolean);
    const uniqueEmails = Array.from(new Set(emailRows.map((e) => e.toLowerCase())));
    const existingContacts = uniqueEmails.length
      ? (await supabase.from("contacts").select("id, email_normalized").in("email_normalized", uniqueEmails)).data || []
      : [];
    const contactByEmail = new Map(existingContacts.map((c) => [c.email_normalized, c.id]));

    const toInsert = [];
    const rowKeys = [];
    const existingUpdates = [];

    safeRows.forEach((raw, idx) => {
      const { first, last } = splitName(raw);
      const email = emailClean(raw.email);
      const emailNorm = email ? email.toLowerCase() : null;
      if (!first && !last && !email) return;
      const companyId = companyMap.get((clean(raw.company) || "").toLowerCase())?.id || null;
      const ownerId = ownerIdForIndex(ownerAssignments, idx, user.id, options.ownerId);
      const ownerText = ownerTextForIndex(ownerAssignments, idx);
      const row = {
        first_name: first || email || "Unknown",
        last_name: last,
        job_title: clean(raw.job_title),
        email,
        phone: clean(raw.phone),
        linkedin: clean(raw.linkedin),
        company_id: companyId,
        country: clean(raw.country),
        city: clean(raw.city),
        source: clean(raw.source) || clean(raw._sheet) || (options.destination === "event" ? "event_import" : "excel_import"),
        notes: [ownerText ? `Owner from Excel: ${ownerText}` : null, buildNotes(raw)].filter(Boolean).join(" | ") || null,
        owner_id: ownerId,
        gdpr_consent: isYes(raw.gdpr_consent),
        created_by: user.id,
      };
      if (emailNorm && contactByEmail.has(emailNorm)) {
        existingUpdates.push({ id: contactByEmail.get(emailNorm), row });
      } else {
        toInsert.push(row);
        rowKeys.push({ idx, emailNorm });
      }
    });

    let inserted = 0;
    let skipped = existingUpdates.length;
    for (let i = 0; i < existingUpdates.length; i += 100) {
      await Promise.all(existingUpdates.slice(i, i + 100).map(({ id, row }) => {
        const patch = { owner_id: row.owner_id };
        ["company_id", "job_title", "phone", "linkedin", "country", "city", "source", "notes"].forEach((k) => { if (row[k]) patch[k] = row[k]; });
        return supabase.from("contacts").update(patch).eq("id", id);
      }));
    }
    if (toInsert.length) {
      const { data: created, error } = await supabase.from("contacts").insert(toInsert).select("id, email_normalized");
      if (error) throw new Error(error.message);
      inserted = created?.length || 0;
      (created || []).forEach((c, i) => {
        const key = c.email_normalized || rowKeys[i]?.emailNorm;
        if (key) contactByEmail.set(key, c.id);
        else rowKeys[i].createdId = c.id;
      });
    }

    const groupMap = (leadFileId || eventId) ? await resolveGroups(supabase, user.id, safeRows, { leadFileId, eventId, groupBySheet: options.groupBySheet }) : new Map();
    const groupFor = (raw) => {
      const name = clean(raw.group_name) || (options.groupBySheet ? clean(raw._sheet) : null);
      return name ? groupMap.get(name) || null : null;
    };

    const contactIdFor = (raw, index) => {
      const e = emailClean(raw.email)?.toLowerCase();
      if (e && contactByEmail.has(e)) return contactByEmail.get(e);
      return rowKeys.find((r) => r.idx === index)?.createdId || null;
    };

    let linked = 0;
    let eventRegistrations = 0;
    if (leadFileId) {
      const leadRows = safeRows.map((raw, index) => {
        const contactId = contactIdFor(raw, index);
        if (!contactId) return null;
        return { lead_file_id: leadFileId, contact_id: contactId, group_id: groupFor(raw), status: clean(raw.final_decision) || clean(raw.rsvp) || clean(raw.next_step), rsvp: normalizeRsvp(raw.final_decision, raw.rsvp), notes: buildNotes(raw), added_by: user.id };
      }).filter(Boolean);
      for (let i = 0; i < leadRows.length; i += 500) {
        const { error } = await supabase.from("lead_contacts").upsert(leadRows.slice(i, i + 500), { onConflict: "lead_file_id,contact_id", ignoreDuplicates: false });
        if (error) throw new Error(error.message);
        linked += leadRows.slice(i, i + 500).length;
      }
    }

    if (eventId) {
      const regRows = safeRows.map((raw, index) => {
        const contactId = contactIdFor(raw, index);
        if (!contactId) return null;
        const rsvp = normalizeRsvp(raw.final_decision, raw.rsvp);
        const status = registrationStatus(raw);
        return {
          event_id: eventId,
          contact_id: contactId,
          registration_source: "event",
          status,
          rsvp,
          group_id: groupFor(raw),
          requested_by: ownerIdForIndex(ownerAssignments, index, user.id, options.ownerId),
          response_date: clean(raw.response_date) || clean(raw.last_contact),
          gdpr_consent: isYes(raw.gdpr_consent),
          hub_consent: isYes(raw.hub_consent) || isYes(raw.gdpr_consent),
          partner_consent: isYes(raw.partner_consent),
          participant_type: participantType(raw),
          badge_status: badgeStatus(raw),
          last_note: buildNotes(raw),
          last_activity_at: clean(raw.response_date) ? new Date().toISOString() : null,
          notes: [ownerTextForIndex(ownerAssignments, index) ? `Responsible from Excel: ${ownerTextForIndex(ownerAssignments, index)}` : null, clean(raw.notes), clean(raw.final_decision), clean(raw.rsvp)].filter(Boolean).join(" | ") || null,
        };
      }).filter(Boolean);
      for (let i = 0; i < regRows.length; i += 500) {
        const chunk = regRows.slice(i, i + 500);
        const { error } = await supabase.from("event_registrations").upsert(chunk, { onConflict: "event_id,contact_id", ignoreDuplicates: false });
        if (error) throw new Error(error.message);
        eventRegistrations += chunk.length;
        linked += chunk.length;
      }
    }

    let deals = 0;
    if ((options.createDeals || options.destination === "sales_pipeline") && leadFileId) {
      const companyIds = Array.from(new Set(safeRows.map((r) => companyMap.get((clean(r.company) || "").toLowerCase())?.id).filter(Boolean)));
      for (const companyId of companyIds) {
        const sample = safeRows.find((r) => companyMap.get((clean(r.company) || "").toLowerCase())?.id === companyId) || {};
        const { data: existingDeal } = await supabase.from("deals").select("id").eq("lead_file_id", leadFileId).eq("company_id", companyId).limit(1).maybeSingle();
        let dealId = existingDeal?.id;
        if (!dealId) {
          const { data: deal, error } = await supabase.from("deals").insert({ lead_file_id: leadFileId, company_id: companyId, company_name: clean(sample.company), group_id: groupFor(sample), owner_id: ownerIdForIndex(ownerAssignments, safeRows.indexOf(sample), user.id, options.ownerId), stage: "prospect", notes: buildNotes(sample) || "Created from Excel import", created_by: user.id }).select("id").single();
          if (error) throw new Error(error.message);
          dealId = deal.id;
          deals++;
        }
        const reps = safeRows.map((raw, index) => {
          const cid = companyMap.get((clean(raw.company) || "").toLowerCase())?.id;
          if (cid !== companyId) return null;
          const contactId = contactIdFor(raw, index);
          return contactId ? { deal_id: dealId, contact_id: contactId, rsvp: normalizeRsvp(raw.final_decision, raw.rsvp), notes: buildNotes(raw) } : null;
        }).filter(Boolean);
        if (reps.length) await supabase.from("deal_reps").upsert(reps, { onConflict: "deal_id,contact_id", ignoreDuplicates: false });
      }
    }

    const enrichResult = await enrichCompanies(supabase, companyMap, safeRows, options.enrichCompanies !== false);

    revalidatePath("/contacts");
    revalidatePath("/companies");
    revalidatePath("/leads");
    revalidatePath("/sales");
    revalidatePath("/events");
    if (leadFileId) revalidatePath(`/leads/${leadFileId}`);
    if (eventId) revalidatePath(`/events/${eventId}`);
    return { ok: true, inserted, skipped, linked, deals, eventRegistrations, enrichedCompanies: enrichResult.enriched, leadFileId, eventId };
  } catch (error) {
    return { ok: false, error: error.message || "import_failed", inserted: 0, skipped: 0, linked: 0, deals: 0, eventRegistrations: 0, enrichedCompanies: 0 };
  }
}
