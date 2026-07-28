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

// This "cache" is not AI/LLM-generated (no MailBos or OpenAI key needed) —
// it's a free scrape of the company's own public website (title/meta
// description tags) dropped into a fixed template. Only the fixed labels
// and boilerplate below are ours to translate; the scraped sentences
// (what they do / value proposition) are the target site's own text, in
// whatever language that site happens to publish in.
const CACHE_COPY = {
  en: {
    company: "Company", whatTheyDo: "What they do", products: "Products / services", productsHint: (h) => `Public website metadata suggests: ${h}. Verify exact products/services manually.`,
    targetCustomers: "Target customers", targetCustomersHint: "Not verified automatically. Use CRM notes, website pages, and outreach context to complete this field.",
    geography: "Geography", geographyHint: (w) => `Not verified automatically${w ? `; public website/domain detected at ${w}.` : "."}`,
    differentiators: "Differentiators", differentiatorsHint: "Not verified automatically. Add differentiators from website copy, client list, or sales call notes.",
    valueProposition: "Value proposition", businessModel: "Business model", companySize: "Company size", notableClients: "Notable clients", tone: "Tone", website: "Website",
    notVerified: "Not verified automatically.", websiteNotFound: "Not found",
    noDescription: "No reliable public description was found automatically. Add details manually or refresh after adding a website/domain.",
    bmSoftware: "Likely software/platform-led; verify pricing and delivery model with the website or sales notes.",
    bmService: "Likely service/consulting-led; verify exact offering and commercial model.",
    bmProduct: "Likely product/retail-led; verify channels, target customer and distribution.",
    tonePremium: "premium / brand-conscious", toneTech: "professional / innovation-focused", toneDefault: "professional",
  },
  tr: {
    company: "Şirket", whatTheyDo: "Ne yapıyorlar", products: "Ürünler / hizmetler", productsHint: (h) => `Kamuya açık site verisine göre: ${h}. Kesin ürün/hizmetleri manuel doğrula.`,
    targetCustomers: "Hedef müşteriler", targetCustomersHint: "Otomatik doğrulanmadı. Bu alanı CRM notları, site sayfaları ve görüşme bağlamıyla tamamla.",
    geography: "Coğrafya", geographyHint: (w) => `Otomatik doğrulanmadı${w ? `; ${w} adresinde bir site/domain tespit edildi.` : "."}`,
    differentiators: "Farklılaştırıcılar", differentiatorsHint: "Otomatik doğrulanmadı. Site metninden, müşteri listesinden veya görüşme notlarından farklılaştırıcı ekle.",
    valueProposition: "Değer önerisi", businessModel: "İş modeli", companySize: "Şirket büyüklüğü", notableClients: "Önemli müşteriler", tone: "Ton", website: "Website",
    notVerified: "Otomatik doğrulanmadı.", websiteNotFound: "Bulunamadı",
    noDescription: "Otomatik olarak güvenilir bir açıklama bulunamadı. Manuel olarak ekle veya bir website/domain ekledikten sonra tekrar dene.",
    bmSoftware: "Muhtemelen yazılım/platform odaklı; fiyatlandırma ve teslimat modelini site veya satış notlarından doğrula.",
    bmService: "Muhtemelen danışmanlık/hizmet odaklı; tam teklifi ve ticari modeli doğrula.",
    bmProduct: "Muhtemelen ürün/perakende odaklı; kanalları, hedef müşteriyi ve dağıtımı doğrula.",
    tonePremium: "premium / marka odaklı", toneTech: "profesyonel / inovasyon odaklı", toneDefault: "profesyonel",
  },
  it: {
    company: "Azienda", whatTheyDo: "Cosa fanno", products: "Prodotti / servizi", productsHint: (h) => `I metadati del sito pubblico suggeriscono: ${h}. Verifica manualmente i prodotti/servizi esatti.`,
    targetCustomers: "Clienti target", targetCustomersHint: "Non verificato automaticamente. Usa le note CRM, le pagine del sito e il contesto di contatto per completare questo campo.",
    geography: "Geografia", geographyHint: (w) => `Non verificato automaticamente${w ? `; sito/dominio pubblico rilevato su ${w}.` : "."}`,
    differentiators: "Elementi distintivi", differentiatorsHint: "Non verificato automaticamente. Aggiungi elementi distintivi dal sito, dalla lista clienti o dalle note di vendita.",
    valueProposition: "Proposta di valore", businessModel: "Modello di business", companySize: "Dimensione azienda", notableClients: "Clienti rilevanti", tone: "Tono", website: "Sito web",
    notVerified: "Non verificato automaticamente.", websiteNotFound: "Non trovato",
    noDescription: "Non è stata trovata automaticamente una descrizione pubblica affidabile. Aggiungi i dettagli manualmente o aggiorna dopo aver inserito un sito/dominio.",
    bmSoftware: "Probabilmente orientato a software/piattaforma; verifica prezzi e modello di consegna sul sito o nelle note di vendita.",
    bmService: "Probabilmente orientato a consulenza/servizi; verifica l'offerta esatta e il modello commerciale.",
    bmProduct: "Probabilmente orientato a prodotto/retail; verifica canali, cliente target e distribuzione.",
    tonePremium: "premium / attento al brand", toneTech: "professionale / orientato all'innovazione", toneDefault: "professionale",
  },
};

function cacheCopy(locale) {
  return CACHE_COPY[locale] || CACHE_COPY.en;
}

function inferBusinessModel(text, locale) {
  const copy = cacheCopy(locale);
  const hay = (text || "").toLowerCase();
  if (/software|platform|saas|app|cloud/.test(hay)) return copy.bmSoftware;
  if (/consult|agency|studio|servizi|services/.test(hay)) return copy.bmService;
  if (/shop|store|retail|ecommerce|e-commerce|brand|product/.test(hay)) return copy.bmProduct;
  return copy.notVerified;
}

function inferTone(text, locale) {
  const copy = cacheCopy(locale);
  const hay = (text || "").toLowerCase();
  if (/luxury|premium|design|fashion|beauty/.test(hay)) return copy.tonePremium;
  if (/technology|innovation|software|platform|ai/.test(hay)) return copy.toneTech;
  return copy.toneDefault;
}

function structuredCompanyCache({ name, website, title, description, locale }) {
  const copy = cacheCopy(locale);
  const main = shortSentence(description || title, copy.noDescription);
  const headline = shortSentence(title, name);
  const text = `${title || ""} ${description || ""}`;
  return [
    `${copy.company}: ${name}`,
    `${copy.whatTheyDo}: ${main}`,
    `${copy.products}: ${copy.productsHint(headline)}`,
    `${copy.targetCustomers}: ${copy.targetCustomersHint}`,
    `${copy.geography}: ${copy.geographyHint(website)}`,
    `${copy.differentiators}: ${copy.differentiatorsHint}`,
    `${copy.valueProposition}: ${main}`,
    `${copy.businessModel}: ${inferBusinessModel(text, locale)}`,
    `${copy.companySize}: ${copy.notVerified}`,
    `${copy.notableClients}: ${copy.notVerified}`,
    `${copy.tone}: ${inferTone(text, locale)}`,
    `${copy.website}: ${website || copy.websiteNotFound}`,
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

async function enrichCompanyRecord(company, locale) {
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
    return { website: existing || url, overview: structuredCompanyCache({ name: company.name, website: existing || url, title, description, locale }) };
  }
  return { website: existing || null, overview: structuredCompanyCache({ name: company.name, website: existing, title: null, description: null, locale }) };
}

export async function enrichExistingCompanies(locale) {
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
      const info = await enrichCompanyRecord(company, locale);
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

export async function refreshCompanyCache(companyId, locale) {
  const { supabase } = await requireProfile();
  const { data: company, error } = await supabase
    .from("companies")
    .select("id, name, website, overview")
    .eq("id", companyId)
    .single();
  if (error || !company) return { ok: false, error: error?.message || "not_found" };
  const info = await enrichCompanyRecord(company, locale);
  const patch = { overview: info.overview };
  if (info.website) patch.website = info.website;
  const { error: updateError } = await supabase.from("companies").update(patch).eq("id", company.id);
  if (updateError) return { ok: false, error: updateError.message };
  revalidatePath(`/companies/${company.id}`);
  revalidatePath("/companies");
  return { ok: true };
}

