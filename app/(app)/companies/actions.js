"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function clean(v) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

export async function saveCompany(prevState, formData) {
  const { supabase, user } = await requireProfile();

  const id = clean(formData.get("id"));
  const name = clean(formData.get("name"));
  if (!name) return { error: "name_required" };

  const row = {
    name,
    sector: clean(formData.get("sector")),
    country: clean(formData.get("country")),
    city: clean(formData.get("city")),
    website: clean(formData.get("website")),
    overview: clean(formData.get("overview")),
  };

  let companyId = id;
  if (id) {
    const { error } = await supabase.from("companies").update(row).eq("id", id);
    if (error) return { error: error.message };
  } else {
    row.created_by = user.id;
    const { data, error } = await supabase
      .from("companies")
      .insert(row)
      .select("id")
      .single();
    if (error) return { error: error.message };
    companyId = data.id;
  }

  revalidatePath("/companies");
  redirect(`/companies/${companyId}`);
}

export async function deleteCompany(id) {
  const { supabase } = await requireProfile();
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/companies");
  redirect("/companies");
}

const ENRICH_LIMIT = 120;
const ENRICH_TIMEOUT_MS = 2200;

function normCompany(v) {
  return (clean(v) || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeCompanyUrl(v) {
  const raw = clean(v);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw)) return `https://${raw}`;
  return null;
}

function companySlug(name) {
  return normCompany(name).replace(/\b(srl|srls|spa|ltd|limited|inc|gmbh|sas|sa|bv)\b/g, "").replace(/[^a-z0-9]/g, "").slice(0, 36);
}

function stripCompanyHtml(v) {
  return clean(String(v || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
}

function readMeta(html, prop) {
  const esc = prop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re1 = new RegExp(`<meta[^>]+(?:name|property)=["']${esc}["'][^>]+content=["']([^"']+)["']`, "i");
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${esc}["']`, "i");
  return html.match(re1)?.[1] || html.match(re2)?.[1] || null;
}

function pageTitle(html) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || null;
}

function shortSentence(v, fallback) {
  const cleaned = stripCompanyHtml(v || "");
  if (!cleaned) return fallback;
  return cleaned.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).slice(0, 2).join(" ").slice(0, 360);
}

function inferBusinessModel(text) {
  const hay = (text || "").toLowerCase();
  if (/software|platform|saas|app|cloud/.test(hay)) return "Likely software/platform-led; verify pricing and delivery model with the website or sales notes.";
  if (/consult|agency|studio|servizi|services/.test(hay)) return "Likely service/consulting-led; verify exact offering and commercial model.";
  if (/shop|store|retail|ecommerce|e-commerce|brand|product/.test(hay)) return "Likely product/retail-led; verify channels, target customer and distribution.";
  return "Not verified automatically.";
}

function inferTone(text) {
  const hay = (text || "").toLowerCase();
  if (/luxury|premium|design|fashion|beauty/.test(hay)) return "premium / brand-conscious";
  if (/technology|innovation|software|platform|ai/.test(hay)) return "professional / innovation-focused";
  return "professional";
}

function structuredCompanyCache({ name, website, title, description }) {
  const main = shortSentence(description || title, "No reliable public description was found automatically. Add details manually or refresh after adding a website/domain.");
  const headline = shortSentence(title, name);
  const text = `${title || ""} ${description || ""}`;
  return [
    `Company: ${name}`,
    `What they do: ${main}`,
    `Products / services: Public website metadata suggests: ${headline}. Verify exact products/services manually.`,
    `Target customers: Not verified automatically. Use CRM notes, website pages, and outreach context to complete this field.`,
    `Geography: Not verified automatically${website ? `; public website/domain detected at ${website}.` : "."}`,
    `Differentiators: Not verified automatically. Add differentiators from website copy, client list, or sales call notes.`,
    `Value proposition: ${main}`,
    `Business model: ${inferBusinessModel(text)}`,
    `Company size: Not verified automatically.`,
    `Notable clients: Not verified automatically.`,
    `Tone: ${inferTone(text)}`,
    `Website: ${website || "Not found"}`,
  ].join("\n");
}

function isWeakOverview(overview) {
  const text = String(overview || "");
  if (!text.trim()) return true;
  if (/To be verified\.|Not verified automatically\./g.test(text) && text.length < 500) return true;
  const values = text.split(/\n+/).map((line) => line.split(":").slice(1).join(":").trim()).filter(Boolean);
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  return Array.from(counts.values()).some((n) => n >= 3);
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ENRICH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow", headers: { "user-agent": "HubConnect company cache bot" } });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.includes("text/html")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function enrichCompanyRecord(company) {
  const candidates = [];
  const existing = normalizeCompanyUrl(company.website);
  if (existing) candidates.push(existing);
  const slug = companySlug(company.name);
  if (slug) candidates.push(`https://${slug}.com`, `https://${slug}.it`, `https://www.${slug}.com`);
  for (const url of Array.from(new Set(candidates)).slice(0, 4)) {
    const html = await fetchHtml(url);
    if (!html) continue;
    const title = stripCompanyHtml(readMeta(html, "og:title") || pageTitle(html));
    const description = stripCompanyHtml(readMeta(html, "description") || readMeta(html, "og:description"));
    return { website: existing || url, overview: structuredCompanyCache({ name: company.name, website: existing || url, title, description }) };
  }
  return { website: existing || null, overview: structuredCompanyCache({ name: company.name, website: existing, title: null, description: null }) };
}

export async function enrichExistingCompanies() {
  const { supabase } = await requireProfile();
  const { data: companies = [], error } = await supabase
    .from("companies")
    .select("id, name, website, overview")
    .order("name")
    .limit(ENRICH_LIMIT * 2);
  if (error) return { ok: false, error: error.message };

  const targets = companies.filter((company) => !company.website || isWeakOverview(company.overview)).slice(0, ENRICH_LIMIT);
  let enriched = 0;
  for (let i = 0; i < targets.length; i += 6) {
    const chunk = targets.slice(i, i + 6);
    const results = await Promise.allSettled(chunk.map(async (company) => {
      const info = await enrichCompanyRecord(company);
      const patch = {};
      if (info.website && !company.website) patch.website = info.website;
      if (info.overview && isWeakOverview(company.overview)) patch.overview = info.overview;
      if (!Object.keys(patch).length) return false;
      const { error: updateError } = await supabase.from("companies").update(patch).eq("id", company.id);
      if (updateError) throw updateError;
      return true;
    }));
    enriched += results.filter((r) => r.status === "fulfilled" && r.value).length;
  }

  revalidatePath("/companies");
  return { ok: true, enriched, scanned: targets.length };
}

export async function refreshCompanyCache(companyId) {
  const { supabase } = await requireProfile();
  const { data: company, error } = await supabase
    .from("companies")
    .select("id, name, website, overview")
    .eq("id", companyId)
    .single();
  if (error || !company) return { ok: false, error: error?.message || "not_found" };
  const info = await enrichCompanyRecord(company);
  const patch = { overview: info.overview };
  if (info.website) patch.website = info.website;
  const { error: updateError } = await supabase.from("companies").update(patch).eq("id", company.id);
  if (updateError) return { ok: false, error: updateError.message };
  revalidatePath(`/companies/${company.id}`);
  revalidatePath("/companies");
  return { ok: true };
}

