"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

function clean(v) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

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
  const { supabase, user } = await requireProfile();
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
    const { data: deal, error } = await supabase
      .from("deals")
      .insert(row)
      .select("id")
      .single();
    if (error) return { error: error.message };

    // Optional first representative typed/picked in the Add-deal form.
    let repContactId = clean(formData.get("rep_contact_id"));
    const repFullName = clean(formData.get("rep_full_name"));
    if (!repContactId && repFullName) {
      const parts = repFullName.split(/\s+/);
      const { data: created } = await supabase
        .from("contacts")
        .insert({
          first_name: parts.shift() || repFullName,
          last_name: parts.join(" ") || null,
          email: clean(formData.get("rep_email")),
          phone: clean(formData.get("rep_phone")),
          job_title: clean(formData.get("rep_job_title")),
          company_id: companyId,
          owner_id: row.owner_id,
          source: "sales",
          created_by: user.id,
        })
        .select("id")
        .single();
      repContactId = created?.id ?? null;
    }
    if (repContactId) {
      await supabase
        .from("deal_reps")
        .insert({ deal_id: deal.id, contact_id: repContactId });
    }
  }

  if (leadFileId) revalidatePath(`/leads/${leadFileId}`);
  revalidatePath("/leads");
  revalidatePath("/sales");
  return { ok: Date.now() };
}

export async function setDealStage(dealId, stage, leadFileId) {
  const { supabase } = await requireProfile();
  await supabase.from("deals").update({ stage }).eq("id", dealId);
  if (leadFileId) revalidatePath(`/leads/${leadFileId}`);
  revalidatePath("/sales");
}

export async function deleteDeal(dealId, leadFileId) {
  const { supabase } = await requireProfile();
  await supabase.from("deals").delete().eq("id", dealId);
  if (leadFileId) revalidatePath(`/leads/${leadFileId}`);
  revalidatePath("/sales");
}

// ---- Representatives ---------------------------------------------------

// Add a rep: either an existing contact_id, or a new person (name/email/phone)
// which becomes a real contact under the deal's company.
export async function addRep(prevState, formData) {
  const { supabase, user } = await requireProfile();
  const dealId = clean(formData.get("deal_id"));
  const leadFileId = clean(formData.get("lead_file_id"));
  if (!dealId) return { error: "missing" };

  let contactId = clean(formData.get("contact_id"));

  // New representative typed inline → create a contact.
  if (!contactId) {
    const fullName = clean(formData.get("full_name"));
    if (!fullName) return { error: "name_required" };

    // Inherit the deal's company for the new contact.
    const { data: deal } = await supabase
      .from("deals")
      .select("company_id, owner_id")
      .eq("id", dealId)
      .single();

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
        company_id: deal?.company_id ?? null,
        owner_id: deal?.owner_id ?? user.id,
        source: "sales",
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
  const { supabase } = await requireProfile();
  await supabase.from("deal_reps").update(updates).eq("id", repId);

  // If this deal was already pushed, keep the event_registration's rsvp in sync
  // only when the rsvp itself changed (event team owns the final value otherwise).
  if (updates.rsvp !== undefined) {
    const { data: rep } = await supabase
      .from("deal_reps")
      .select("contact_id, deal:deals(pushed_event_id)")
      .eq("id", repId)
      .single();
    const eventId = rep?.deal?.pushed_event_id;
    if (eventId && rep?.contact_id) {
      await supabase
        .from("event_registrations")
        .update({ rsvp: updates.rsvp })
        .eq("event_id", eventId)
        .eq("contact_id", rep.contact_id)
        .eq("registration_source", "sales");
    }
  }

  if (leadFileId) revalidatePath(`/leads/${leadFileId}`);
  revalidatePath("/sales");
}

export async function removeRep(repId, leadFileId) {
  const { supabase } = await requireProfile();
  await supabase.from("deal_reps").delete().eq("id", repId);
  if (leadFileId) revalidatePath(`/leads/${leadFileId}`);
  revalidatePath("/sales");
}

// ---- Push to event (PO won) -------------------------------------------

// Push a deal's reps into an event. Target can be an existing event_id or a
// new event name (created on the fly). Only reps with rsvp != 'no' are sent;
// each becomes an event_registration (source = 'sales', linked to the deal).
export async function pushDealToEvent(prevState, formData) {
  const { supabase, user } = await requireProfile();
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

  // Find-or-create an event sub-group matching the deal's group name.
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
    if (existingGroup) {
      eventGroupId = existingGroup.id;
    } else {
      const { data: g } = await supabase
        .from("contact_groups")
        .insert({ event_id: eventId, name: groupName, created_by: user.id })
        .select("id")
        .single();
      eventGroupId = g?.id ?? null;
    }
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
    if (exists) {
      await supabase
        .from("event_registrations")
        .update({ rsvp: rep.rsvp, deal_id: dealId, group_id: eventGroupId })
        .eq("id", exists.id);
    } else {
      await supabase.from("event_registrations").insert({
        event_id: eventId,
        contact_id: rep.contact_id,
        registration_source: "sales",
        status: "confirmed",
        rsvp: rep.rsvp,
        group_id: eventGroupId,
        deal_id: dealId,
        requested_by: deal?.owner_id ?? user.id,
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
