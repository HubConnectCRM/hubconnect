"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

function clean(v) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

export async function updateMyProfile(prevState, formData) {
  const { supabase, user } = await requireProfile();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: clean(formData.get("full_name")),
      language: clean(formData.get("language")) || "en",
    })
    .eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: Date.now() };
}

export async function updateUserRole(userId, role) {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "admin") return;
  await supabase.from("profiles").update({ role }).eq("id", userId);
  revalidatePath("/settings");
}

export async function toggleUserActive(userId, isActive) {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "admin") return;
  await supabase.from("profiles").update({ is_active: isActive }).eq("id", userId);
  revalidatePath("/settings");
}
