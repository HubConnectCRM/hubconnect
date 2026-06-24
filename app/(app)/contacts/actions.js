"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function clean(v) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

// Find a company by normalized name, or create it. Returns its id (or null).
async function resolveCompany(supabase, name, userId) {
  const clean_name = clean(name);
  if (!clean_name) return null;
  const norm = clean_name.toLowerCase();
  const { data: existing } = await supabase
    .from("companies")
    .select("id")
    .eq("name_normalized", norm)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created } = await supabase
    .from("companies")
    .insert({ name: clean_name, created_by: userId })
    .select("id")
    .single();
  return created?.id ?? null;
}

export async function saveContact(prevState, formData) {
  const { supabase, user } = await requireProfile();

  const id = clean(formData.get("id"));
  const firstName = clean(formData.get("first_name"));
  const lastName = clean(formData.get("last_name"));
  if (!firstName && !lastName) return { error: "name_required" };

  const companyId = await resolveCompany(
    supabase,
    formData.get("company_name"),
    user.id
  );

  const gdpr = formData.get("gdpr_consent") === "on";
  const row = {
    first_name: firstName,
    last_name: lastName,
    job_title: clean(formData.get("job_title")),
    email: clean(formData.get("email")),
    secondary_email: clean(formData.get("secondary_email")),
    phone: clean(formData.get("phone")),
    linkedin: clean(formData.get("linkedin")),
    company_id: companyId,
    owner_id: clean(formData.get("owner_id")),
    source: clean(formData.get("source")),
    country: clean(formData.get("country")),
    city: clean(formData.get("city")),
    gdpr_consent: gdpr,
    gdpr_consent_date: gdpr ? clean(formData.get("gdpr_consent_date")) : null,
    notes: clean(formData.get("notes")),
  };

  let contactId = id;
  if (id) {
    const { error } = await supabase.from("contacts").update(row).eq("id", id);
    if (error) return { error: error.message };
  } else {
    row.created_by = user.id;
    const { data, error } = await supabase
      .from("contacts")
      .insert(row)
      .select("id")
      .single();
    if (error) return { error: error.message };
    contactId = data.id;
  }

  revalidatePath("/contacts");
  redirect(`/contacts/${contactId}`);
}


// Reusable CRM person creation used by Sales, Lead Files, Deals and Contacts.
// It can create/find a company, deduplicate by normalized email, then optionally
// attach the person to a lead file and/or a deal representative list.
export async function createPerson(prevState, formData) {
  const { supabase, user } = await requireProfile();

  async function resolveCompanyByName(name) {
    const companyName = clean(name);
    if (!companyName) return null;
    const normName = companyName.toLowerCase();
    const website = clean(formData.get("company_website"));
    const overview = clean(formData.get("company_overview"));
    const { data: existing } = await supabase
      .from("companies")
      .select("id, website, overview")
      .eq("name_normalized", normName)
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      const patch = {};
      if (website && !existing.website) patch.website = website;
      if (overview && !existing.overview) patch.overview = overview;
      if (Object.keys(patch).length) await supabase.from("companies").update(patch).eq("id", existing.id);
      return existing.id;
    }
    const { data: created, error } = await supabase
      .from("companies")
      .insert({ name: companyName, website, overview, created_by: user.id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return created?.id ?? null;
  }

  async function resolveLeadFile() {
    const existingId = clean(formData.get("lead_file_id"));
    if (existingId) return existingId;
    const newName = clean(formData.get("lead_file_name"));
    if (!newName) return null;
    const { data, error } = await supabase
      .from("lead_files")
      .insert({ name: newName, created_by: user.id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data?.id ?? null;
  }

  try {
    const fullName = clean(formData.get("full_name"));
    let firstName = clean(formData.get("first_name"));
    let lastName = clean(formData.get("last_name"));
    if (!firstName && !lastName && fullName) {
      const parts = fullName.split(/\s+/);
      firstName = parts.shift() || fullName;
      lastName = parts.join(" ") || null;
    }
    if (!firstName && !lastName) return { error: "name_required" };

    const email = clean(formData.get("email"));
    const emailNorm = email ? email.toLowerCase() : null;
    const companyId = await resolveCompanyByName(formData.get("company_name"));
    const ownerId = clean(formData.get("owner_id")) || user.id;

    let contactId = null;
    let reused = false;
    if (emailNorm) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("email_normalized", emailNorm)
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        contactId = existing.id;
        reused = true;
        // Fill missing useful fields without overwriting the existing record's identity.
        const patch = { owner_id: ownerId };
        if (companyId) patch.company_id = companyId;
        if (clean(formData.get("job_title"))) patch.job_title = clean(formData.get("job_title"));
        if (clean(formData.get("phone"))) patch.phone = clean(formData.get("phone"));
        if (clean(formData.get("linkedin"))) patch.linkedin = clean(formData.get("linkedin"));
        await supabase.from("contacts").update(patch).eq("id", contactId);
      }
    }

    if (!contactId) {
      const { data, error } = await supabase
        .from("contacts")
        .insert({
          first_name: firstName,
          last_name: lastName,
          job_title: clean(formData.get("job_title")),
          email,
          phone: clean(formData.get("phone")),
          linkedin: clean(formData.get("linkedin")),
          company_id: companyId,
          country: clean(formData.get("country")),
          city: clean(formData.get("city")),
          source: clean(formData.get("source")) || "manual",
          notes: clean(formData.get("notes")),
          owner_id: ownerId,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) return { error: error.message };
      contactId = data.id;
    }

    const leadFileId = await resolveLeadFile();
    const groupId = clean(formData.get("group_id"));
    if (leadFileId) {
      const { error } = await supabase.from("lead_contacts").insert({
        lead_file_id: leadFileId,
        contact_id: contactId,
        group_id: groupId || null,
        status: clean(formData.get("lead_status")),
        notes: clean(formData.get("lead_notes")) || clean(formData.get("notes")),
        added_by: user.id,
      });
      if (error && error.code !== "23505") return { error: error.message };
    }

    const dealId = clean(formData.get("deal_id"));
    if (dealId) {
      const { error } = await supabase.from("deal_reps").insert({
        deal_id: dealId,
        contact_id: contactId,
        rsvp: clean(formData.get("rsvp")) || null,
        notes: clean(formData.get("deal_notes")) || null,
      });
      if (error && error.code !== "23505") return { error: error.message };
    }

    revalidatePath("/contacts");
    revalidatePath("/companies");
    revalidatePath("/sales");
    revalidatePath("/leads");
    if (leadFileId) revalidatePath(`/leads/${leadFileId}`);
    return { ok: Date.now(), contactId, reused };
  } catch (e) {
    return { error: e.message || "unexpected_error" };
  }
}

export async function deleteContact(id) {
  const { supabase } = await requireProfile();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/contacts");
  redirect("/contacts");
}

export async function addInteraction(prevState, formData) {
  const { supabase, user } = await requireProfile();
  const contactId = clean(formData.get("contact_id"));
  if (!contactId) return { error: "contact_required" };

  const row = {
    contact_id: contactId,
    user_id: user.id,
    type: clean(formData.get("type")) || "note",
    topic: clean(formData.get("topic")),
    action_text: clean(formData.get("action_text")),
    next_step: clean(formData.get("next_step")),
    next_step_due: clean(formData.get("next_step_due")),
    occurred_on:
      clean(formData.get("occurred_on")) ||
      new Date().toISOString().slice(0, 10),
  };

  const { error } = await supabase.from("interactions").insert(row);
  if (error) return { error: error.message };
  revalidatePath(`/contacts/${contactId}`);
  return { ok: Date.now() };
}

export async function deleteInteraction(id, contactId) {
  const { supabase } = await requireProfile();
  await supabase.from("interactions").delete().eq("id", id);
  revalidatePath(`/contacts/${contactId}`);
}

// On-blur duplicate check by email. Returns a small match or null.
export async function lookupDuplicate(email, excludeId) {
  const norm = clean(email);
  if (!norm) return null;
  const { supabase } = await requireProfile();
  let query = supabase
    .from("contacts")
    .select("id, full_name, company:companies(name)")
    .eq("email_normalized", norm.toLowerCase())
    .limit(1);
  if (excludeId) query = query.neq("id", excludeId);
  const { data } = await query.maybeSingle();
  return data || null;
}

// Lightweight non-AI company enrichment. It uses the company website or the
// contact email domain, fetches the public homepage, and stores the scraped
// title/meta description in companies.overview/website. No paid AI call needed.
export async function previewCompanyEnrichment(name, websiteOrEmail) {
  await requireProfile();
  const companyName = clean(name) || "Company";
  let website = clean(websiteOrEmail);
  if (website && website.includes("@")) website = website.split("@").pop();
  if (website && !/^https?:\/\//i.test(website)) website = `https://${website.replace(/^www\./i, "www.")}`;
  if (!website) return { error: "website_or_email_required" };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(website, { signal: controller.signal, headers: { "user-agent": "Mozilla/5.0 HubConnect Company Enrichment" }, cache: "no-store" });
    clearTimeout(timer);
    const html = await res.text();
    const readMeta = (key) => html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1]
      || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${key}["']`, "i"))?.[1]
      || "";
    const strip = (v) => String(v || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
    const title = strip(readMeta("og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || companyName);
    const description = strip(readMeta("description") || readMeta("og:description") || title);
    const overview = [
      `Company: ${companyName}`,
      `What they do: ${description}`,
      `Products / services: ${description}`,
      `Target customers: To be verified from outreach context and website signals.`,
      `Geography: To be verified.`,
      `Differentiators: Public website metadata collected automatically; enrich manually if needed.`,
      `Value proposition: ${description}`,
      `Business model: To be verified.`,
      `Company size: To be verified.`,
      `Notable clients: To be verified.`,
      `Tone: professional`,
      `Website: ${res.url || website}`,
    ].join("\n");
    return { ok: true, website: res.url || website, title, description, overview };
  } catch (error) {
    return { error: error.name === "AbortError" ? "enrichment_timeout" : error.message };
  }
}
