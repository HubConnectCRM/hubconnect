"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function clean(v) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

export async function addTeamMember(prevState, formData) {
  const { profile } = await requireProfile();
  if (profile.role !== "admin") return { error: "forbidden" };

  const admin = createAdminClient();
  if (!admin) return { error: "no_service_key" };

  const email = clean(formData.get("email"));
  const fullName = clean(formData.get("full_name"));
  const role = clean(formData.get("role")) || "sales";
  if (!email) return { error: "email_required" };

  const tempPassword =
    "Hub-" + Math.random().toString(36).slice(2, 10) + Math.floor(Math.random() * 90 + 10) + "!";

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) return { error: error.message };

  // handle_new_user trigger creates the profile; set role + name explicitly.
  await admin
    .from("profiles")
    .update({ full_name: fullName, role })
    .eq("id", data.user.id);

  revalidatePath("/settings");
  return { ok: Date.now(), email, tempPassword };
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
