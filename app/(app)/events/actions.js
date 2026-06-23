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

export async function saveEvent(prevState, formData) {
  const { supabase, user } = await requireProfile();

  const id = clean(formData.get("id"));
  const name = clean(formData.get("name"));
  if (!name) return { error: "name_required" };

  const row = {
    name,
    location: clean(formData.get("location")),
    start_date: clean(formData.get("start_date")),
    end_date: clean(formData.get("end_date")),
    description: clean(formData.get("description")),
  };

  let eventId = id;
  if (id) {
    const { error } = await supabase.from("events").update(row).eq("id", id);
    if (error) return { error: error.message };
  } else {
    row.created_by = user.id;
    const { data, error } = await supabase
      .from("events")
      .insert(row)
      .select("id")
      .single();
    if (error) return { error: error.message };
    eventId = data.id;
  }

  revalidatePath("/events");
  redirect(`/events/${eventId}`);
}

export async function deleteEvent(id) {
  const { supabase } = await requireProfile();
  await supabase.from("events").delete().eq("id", id);
  revalidatePath("/events");
  redirect("/events");
}

export async function addRegistration(prevState, formData) {
  const { supabase, user } = await requireProfile();
  const eventId = clean(formData.get("event_id"));
  let contactId = clean(formData.get("contact_id"));
  if (!eventId) return { error: "missing" };

  // New person typed inline → create a real contact in the shared pool.
  if (!contactId) {
    const fullName = clean(formData.get("full_name"));
    if (!fullName) return { error: "name_required" };
    const parts = fullName.split(/\s+/);
    const firstName = parts.shift() || fullName;
    const lastName = parts.join(" ") || null;
    const companyId = await resolveCompany(supabase, formData.get("company_name"), user.id);
    const { data: created, error: cErr } = await supabase
      .from("contacts")
      .insert({
        first_name: firstName,
        last_name: lastName,
        email: clean(formData.get("email")),
        phone: clean(formData.get("phone")),
        job_title: clean(formData.get("job_title")),
        company_id: companyId,
        owner_id: user.id,
        source: clean(formData.get("registration_source")) || "event",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (cErr) return { error: cErr.message };
    contactId = created.id;
  }

  const { error } = await supabase.from("event_registrations").insert({
    event_id: eventId,
    contact_id: contactId,
    status: clean(formData.get("status")) || "desiderata",
    group_id: clean(formData.get("group_id")) || null,
    registration_source: clean(formData.get("registration_source")) || "event",
    requested_by: user.id,
  });
  if (error) {
    if (error.code === "23505") return { error: "already_added" };
    return { error: error.message };
  }
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/sales");
  return { ok: Date.now() };
}

export async function moveRegistration(regId, newEventId) {
  const { supabase } = await requireProfile();
  await supabase
    .from("event_registrations")
    .update({ event_id: newEventId, group_id: null })
    .eq("id", regId);
  revalidatePath("/sales");
}

export async function addEventGroup(prevState, formData) {
  const { supabase, user } = await requireProfile();
  const eventId = clean(formData.get("event_id"));
  const name = clean(formData.get("name"));
  if (!eventId || !name) return { error: "missing" };
  const { error } = await supabase.from("contact_groups").insert({
    event_id: eventId,
    name,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/events/${eventId}`);
  return { ok: Date.now() };
}

export async function deleteGroup(id, eventId) {
  const { supabase } = await requireProfile();
  await supabase.from("contact_groups").delete().eq("id", id);
  if (eventId) revalidatePath(`/events/${eventId}`);
  else revalidatePath("/leads");
}

// Set attendance + optional note, and log the change to history (who/when/what).
export async function confirmRsvp(prevState, formData) {
  const { supabase, user } = await requireProfile();
  const id = clean(formData.get("reg_id"));
  const eventId = clean(formData.get("event_id"));
  const rsvp = clean(formData.get("rsvp"));
  const note = clean(formData.get("note"));
  if (!id) return { error: "missing" };

  const { data: reg } = await supabase
    .from("event_registrations")
    .select("status")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("event_registrations")
    .update({ rsvp, last_note: note, last_activity_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("registration_rsvp_history").insert({
    registration_id: id,
    rsvp,
    status: reg?.status ?? null,
    note,
    changed_by: user.id,
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath("/sales");
  return { ok: Date.now() };
}

export async function updateRegistrationStatus(id, status, eventId) {
  const { supabase } = await requireProfile();
  await supabase.from("event_registrations").update({ status }).eq("id", id);
  revalidatePath(`/events/${eventId}`);
}

export async function removeRegistration(id, eventId) {
  const { supabase } = await requireProfile();
  await supabase.from("event_registrations").delete().eq("id", id);
  revalidatePath(`/events/${eventId}`);
}
