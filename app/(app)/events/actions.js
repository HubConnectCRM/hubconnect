"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function clean(v) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
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
  const contactId = clean(formData.get("contact_id"));
  if (!eventId || !contactId) return { error: "missing" };

  const { error } = await supabase.from("event_registrations").insert({
    event_id: eventId,
    contact_id: contactId,
    status: clean(formData.get("status")) || "desiderata",
    requested_by: user.id,
  });
  if (error) {
    if (error.code === "23505") return { error: "already_added" };
    return { error: error.message };
  }
  revalidatePath(`/events/${eventId}`);
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
