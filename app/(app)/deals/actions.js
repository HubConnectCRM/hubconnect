"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

function clean(v) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

function canManageSales(profile) {
  return profile?.role === "admin" || profile?.role === "sales";
}

const salesDenied = () => ({ error: "sales_read_only" });

async function resolveCompany(supabase, name, userId) {
  const name_clean = clean(name);
  if (!name_clean) return null;
  const norm = name_clean.toLowerCase();
  const { data: existing } = await supabase
    .from("companies")
    .select("id")
    .eq("name_normalized", norm)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created } = await supabase
    .from("companies")
    .insert({ name: name_clean, created_by: userId })
    .select("id")
    .single();
  return created?.id ?? null;
}

// ---- Deals -------------------------------------------------------------

export async function saveDeal(prevState, formData) {
  const { supabase, user, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
  const id = clean(formData.get("id"));
  let leadFileId = clean(formData.get("lead_file_id"));
  const leadFileName = clean(formData.get("lead_file_name")); // create file inline
  const companyName = clean(formData.get("company_name"));
  if (!companyName) return { error: "company_required" };

  // When creating a deal from Sales without a file, make the lead file on the fly.
  if (!id && !leadFileId && leadFileName) {
    const { data: lf, error: lfErr } = await supabase
      .from("lead_files")
      .insert({ name: leadFileName, created_by: user.id })
      .select("id")
      .single();
    if (lfErr) return { error: lfErr.message };
    leadFileId = lf.id;
  }
  if (!id && !leadFileId) return { error: "file_required" };

  const companyId = await resolveCompany(supabase, companyName, user.id);

  const row = {
    company_id: companyId,
    company_name: companyName,
    group_id: clean(formData.get("group_id")) || null,
    owner_id: clean(formData.get("owner_id")) || user.id,
    stage: clean(formData.get("stage")) || "prospect",
    notes: clean(formData.get("notes")),
  };

  if (id) {
    const { error } = await supabase.from("deals").update(row).eq("id", id);
    if (error) return { error: error.message };
  } else {
    row.lead_file_id = leadFileId;
    row.created_by = user.id;
    const { error } = await supabase.from("deals").insert(row);
    if (error) return { error: error.message };
  }

  if (leadFileId) revalidatePath(`/leads/${leadFileId}`);
  revalidatePath("/leads");
  revalidatePath("/sales");
  return { ok: Date.now() };
}

export async function setDealStage(dealId, stage, leadFileId) {
  const { supabase, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
  // won_at is the only stable timestamp for "when was this actually won" —
  // updated_at gets bumped by any unrelated edit (adding a rep, price sync),
  // which used to make the Sales page's date filter show stale won deals
  // as if they'd just happened.
  const patch = { stage, won_at: stage === "won" ? new Date().toISOString() : null };
  await supabase.from("deals").update(patch).eq("id", dealId);
  if (leadFileId) revalidatePath(`/leads/${leadFileId}`);
  revalidatePath("/sales");
}

export async function deleteDeal(dealId, leadFileId) {
  const { supabase, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
  await supabase.from("deals").delete().eq("id", dealId);
  if (leadFileId) revalidatePath(`/leads/${leadFileId}`);
  revalidatePath("/sales");
}

// ---- Representatives ---------------------------------------------------

// Add a rep: either an existing contact_id, or a new person (name/email/phone)
// which becomes a real contact under the deal's company.
export async function addRep(prevState, formData) {
  const { supabase, user, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
  const dealId = clean(formData.get("deal_id"));
  const leadFileId = clean(formData.get("lead_file_id"));
  if (!dealId) return { error: "missing" };

  let contactId = clean(formData.get("contact_id"));

  // New representative typed inline → create a contact.
  if (!contactId) {
    const fullName = clean(formData.get("full_name"));
    if (!fullName) return { error: "name_required" };

    // Inherit the deal's company for the new contact (unless one is typed).
    const { data: deal } = await supabase
      .from("deals")
      .select("company_id, owner_id")
      .eq("id", dealId)
      .single();

    const typedCompany = clean(formData.get("company_name"));
    const companyId = typedCompany
      ? await resolveCompany(supabase, typedCompany, user.id)
      : deal?.company_id ?? null;

    const parts = fullName.split(/\s+/);
    const firstName = parts.shift() || fullName;
    const lastName = parts.join(" ") || null;

    const { data: created, error: cErr } = await supabase
      .from("contacts")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email: clean(formData.get("email")),
        phone: clean(formData.get("phone")),
        job_title: clean(formData.get("job_title")),
        linkedin: clean(formData.get("linkedin")),
        company_id: companyId,
        owner_id: deal?.owner_id ?? user.id,
        source: clean(formData.get("source")) || "sales",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (cErr) return { error: cErr.message };
    contactId = created.id;
  }

  const { error } = await supabase.from("deal_reps").insert({
    deal_id: dealId,
    contact_id: contactId,
    rsvp: clean(formData.get("rsvp")),
  });
  if (error) {
    if (error.code === "23505") return { error: "already_added" };
    return { error: error.message };
  }

  if (leadFileId) revalidatePath(`/leads/${leadFileId}`);
  revalidatePath("/sales");
  return { ok: Date.now() };
}

export async function updateRep(repId, updates, leadFileId) {
  const { supabase, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
  await supabase.from("deal_reps").update(updates).eq("id", repId);

  // Sales RSVP remains a pipeline indication. Events owns the final event confirmation,
  // so changing a representative here never overwrites event_registrations.rsvp.

  if (leadFileId) revalidatePath(`/leads/${leadFileId}`);
  revalidatePath("/sales");
}

export async function removeRep(repId, leadFileId) {
  const { supabase, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
  await supabase.from("deal_reps").delete().eq("id", repId);
  if (leadFileId) revalidatePath(`/leads/${leadFileId}`);
  revalidatePath("/sales");
}

// ---- Push to event (PO won) -------------------------------------------

// Push a deal's reps into an event. Target can be an existing event_id or a
// new event name (created on the fly). Only reps with rsvp != 'no' are sent;
// each becomes an event_registration (source = 'sales', linked to the deal).
export async function pushDealToEvent(prevState, formData) {
  const { supabase, user, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
  const dealId = clean(formData.get("deal_id"));
  const leadFileId = clean(formData.get("lead_file_id"));
  let eventId = clean(formData.get("event_id"));
  const newEventName = clean(formData.get("new_event_name"));
  if (!dealId) return { error: "missing" };

  // Create the event on the fly if needed.
  if (!eventId && newEventName) {
    const { data: ev, error: evErr } = await supabase
      .from("events")
      .insert({ name: newEventName, created_by: user.id })
      .select("id")
      .single();
    if (evErr) return { error: evErr.message };
    eventId = ev.id;
  }
  if (!eventId) return { error: "event_required" };

  // Load the deal + its group name (to mirror the sub-group into the event).
  const { data: deal } = await supabase
    .from("deals")
    .select("group_id, owner_id, group:contact_groups(name)")
    .eq("id", dealId)
    .single();

  // Sales may link to an existing Event group, but cannot create or edit Event-owned groups.
  let eventGroupId = null;
  const groupName = deal?.group?.name;
  if (groupName) {
    const { data: existingGroup } = await supabase
      .from("contact_groups")
      .select("id")
      .eq("event_id", eventId)
      .eq("name", groupName)
      .limit(1)
      .maybeSingle();
    if (existingGroup) eventGroupId = existingGroup.id;
  }

  // Pull reps (skip the explicit 'no' ones).
  const { data: reps } = await supabase
    .from("deal_reps")
    .select("contact_id, rsvp")
    .eq("deal_id", dealId);

  for (const rep of reps || []) {
    if (!rep.contact_id) continue;
    if (rep.rsvp === "no") continue;
    // Upsert: skip if already registered for this event.
    const { data: exists } = await supabase
      .from("event_registrations")
      .select("id")
      .eq("event_id", eventId)
      .eq("contact_id", rep.contact_id)
      .limit(1)
      .maybeSingle();
    if (!exists) {
      await supabase.from("event_registrations").insert({
        event_id: eventId,
        contact_id: rep.contact_id,
        registration_source: "sales",
        status: "registered",
        // Every sales-sourced registration is a sponsor — a won, paid deal
        // is sponsorship revenue, not a guest/speaker booking. The Events
        // team handles guest/speaker registrations themselves, separately,
        // via the "Add a contact to this event" form.
        participant_type: "sponsor",
        rsvp: null,
        group_id: eventGroupId,
        deal_id: dealId,
        requested_by: deal?.owner_id ?? user.id,
        notes: rep.rsvp ? `Sales indication: ${rep.rsvp}. Events team confirmation required.` : "Events team confirmation required.",
      });
    }
  }

  await supabase
    .from("deals")
    .update({
      stage: "won",
      po_won: true,
      pushed_event_id: eventId,
      pushed_at: new Date().toISOString(),
    })
    .eq("id", dealId);

  if (leadFileId) revalidatePath(`/leads/${leadFileId}`);
  revalidatePath("/sales");
  revalidatePath(`/events/${eventId}`);
  return { ok: Date.now(), eventId };
}
