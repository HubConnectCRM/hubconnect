"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { encodeMailbosKey, pingMailbos } from "@/lib/mailbos";
import { encodeOpenAIKey } from "@/lib/openai";

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

export async function createCompanyInvite(prevState, formData) {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "admin") return { error: "forbidden" };
  const email = clean(formData.get("email"));
  const role = clean(formData.get("role")) || "sales";
  const days = Math.max(1, Number(clean(formData.get("days")) || 14));
  const { data, error } = await supabase.rpc("create_employee_invite", { p_email: email, p_role: role, p_days: days });
  if (error) return { error: error.message };
  return { ok: Date.now(), code: data, email, role, days };
}

export async function deleteTeamMember(userId) {
  const { profile } = await requireProfile();
  if (profile.role !== "admin" || profile.id === userId) return { error: "forbidden" };
  const admin = createAdminClient();
  if (!admin) return { error: "no_service_key" };
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function connectMailbos(prevState, formData) {
  const { supabase, user } = await requireProfile();
  const key = clean(formData.get("api_key"));
  if (!key) return { error: "invalid_key" };

  let senderEmail = "";
  let provider = "gmail";
  let keyId = null;
  let label = "MailBos";
  try {
    const data = await pingMailbos(key);
    senderEmail = data.sender?.email || "";
    provider = data.sender?.provider || "gmail";
    keyId = data.key_id || null;
    label = data.label || "MailBos";
  } catch (error) {
    const message = error?.message || "mailbos_unreachable";
    if (message.includes("401") || message.includes("403") || message.includes("invalid") || message.includes("unauthorized")) {
      return { error: "invalid_key" };
    }
    return { error: message };
  }

  const keyEnc = encodeMailbosKey(key);
  const { error } = await supabase
    .from("profiles")
    .update({
      mailbos_api_key_enc: keyEnc,
      mailbos_sender_email: senderEmail,
      mailbos_provider: provider,
      mailbos_key_id: keyId,
      mailbos_label: label,
    })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/mail");
  return { ok: true, senderEmail, provider, label };
}

export async function disconnectMailbos() {
  const { supabase, user } = await requireProfile();
  await supabase
    .from("profiles")
    .update({
      mailbos_api_key_enc: null,
      mailbos_sender_email: null,
      mailbos_provider: null,
      mailbos_key_id: null,
      mailbos_label: null,
    })
    .eq("id", user.id);
  revalidatePath("/settings");
  revalidatePath("/mail");
  return { ok: true };
}

// Opt-in, per-user key for the merged call-conversation AI summary — only
// used as a fallback when nobody's iPhone already generated one for free
// (see app/(app)/calls/actions.js's generateConversationInsights). Not the
// same as the company-wide OPENAI_API_KEY env var the single-person call
// note summary already looks for (currently unset in production).
export async function connectOpenAI(prevState, formData) {
  const { supabase, user } = await requireProfile();
  const key = clean(formData.get("api_key"));
  if (!key) return { error: "invalid_key" };
  const { error } = await supabase.from("profiles").update({ openai_api_key_enc: encodeOpenAIKey(key) }).eq("id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function disconnectOpenAI() {
  const { supabase, user } = await requireProfile();
  await supabase.from("profiles").update({ openai_api_key_enc: null }).eq("id", user.id);
  revalidatePath("/settings");
  return { ok: true };
}
