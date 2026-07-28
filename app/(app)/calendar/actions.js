"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

function clean(value) {
  const result = (value ?? "").toString().trim();
  return result || null;
}

export async function createMeeting(prevState, formData) {
  const { supabase, user } = await requireProfile();
  const startAt = clean(formData.get("start_at"));
  const endAt = clean(formData.get("end_at"));
  if (!startAt || !endAt || new Date(endAt) <= new Date(startAt)) return { error: "invalid_time" };

  const { error } = await supabase.from("meetings").insert({
    owner_id: user.id,
    contact_id: clean(formData.get("contact_id")),
    title: clean(formData.get("title")) || "",
    meeting_link: clean(formData.get("meeting_link")) || "",
    location: clean(formData.get("location")) || "",
    start_at: new Date(startAt).toISOString(),
    end_at: new Date(endAt).toISOString(),
    note: clean(formData.get("note")) || "",
  });
  if (error) return { error: error.message };
  revalidatePath("/calendar");
  return { ok: Date.now() };
}

export async function deleteMeeting(id) {
  const { supabase, user, profile } = await requireProfile();
  let query = supabase.from("meetings").delete().eq("id", id);
  if (profile.role !== "admin") query = query.eq("owner_id", user.id);
  const { error } = await query;
  if (error) return { error: error.message };
  revalidatePath("/calendar");
  return { ok: true };
}
