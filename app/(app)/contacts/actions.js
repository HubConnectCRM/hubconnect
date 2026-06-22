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
