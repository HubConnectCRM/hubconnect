"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

const clean = (value) => String(value || "").trim();

async function uploadChatImage(supabase, userId, file) {
  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) return null;
  if (!file.type?.startsWith("image/")) throw new Error("image_required");
  if (file.size > 12 * 1024 * 1024) throw new Error("image_too_large");
  const ext = clean(file.name).split(".").pop()?.toLowerCase() || "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("chat-images").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from("chat-images").getPublicUrl(path).data.publicUrl;
}

export async function sendChatMessage(prevState, formData) {
  const { supabase, user } = await requireProfile();
  const groupId = clean(formData.get("group_id"));
  const body = clean(formData.get("body"));
  if (!groupId) return { error: "missing_group" };
  try {
    const imageUrl = await uploadChatImage(supabase, user.id, formData.get("image"));
    if (!body && !imageUrl) return { error: "empty_message" };
    const { error } = await supabase.from("chat_messages").insert({ group_id: groupId, sender_id: user.id, body: body || "", image_url: imageUrl });
    if (error) return { error: error.message };
    revalidatePath("/chat");
    return { ok: Date.now() };
  } catch (error) { return { error: error.message }; }
}

export async function editChatMessage(messageId, body) {
  const { supabase, user } = await requireProfile();
  const value = clean(body);
  if (!value) return { error: "empty_message" };
  const { error } = await supabase.from("chat_messages").update({ body: value, edited_at: new Date().toISOString() }).eq("id", messageId).eq("sender_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

export async function deleteChatMessage(messageId) {
  const { supabase, user } = await requireProfile();
  const { error } = await supabase.from("chat_messages").delete().eq("id", messageId).eq("sender_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

export async function markChatRead(groupId) {
  const { supabase, user } = await requireProfile();
  const { error } = await supabase.from("chat_read_state").upsert({ group_id: groupId, user_id: user.id, last_read_at: new Date().toISOString() }, { onConflict: "group_id,user_id" });
  if (error) return { error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

export async function createChat(prevState, formData) {
  const { supabase, user } = await requireProfile();
  const mode = clean(formData.get("mode")) || "direct";
  const selected = [...new Set(formData.getAll("member_id").map(clean).filter((id) => id && id !== user.id))];
  if (mode === "direct" && !selected.length) return { error: "member_required" };

  if (mode === "direct") {
    const teammateId = selected[0];
    const { data: myMemberships } = await supabase.from("chat_group_members").select("group_id").eq("user_id", user.id);
    const ids = (myMemberships || []).map((item) => item.group_id);
    if (ids.length) {
      const [{ data: customGroups }, { data: allMembers }] = await Promise.all([
        supabase.from("chat_groups").select("id").eq("kind", "custom").in("id", ids),
        supabase.from("chat_group_members").select("group_id,user_id").in("group_id", ids),
      ]);
      const match = (customGroups || []).find((group) => {
        const users = (allMembers || []).filter((item) => item.group_id === group.id).map((item) => item.user_id);
        return users.length === 2 && users.includes(user.id) && users.includes(teammateId);
      });
      if (match) return { ok: Date.now(), groupId: match.id };
    }
  }

  const name = mode === "direct" ? clean(formData.get("direct_name")) || "Direct message" : clean(formData.get("name"));
  if (!name) return { error: "name_required" };
  const memberIds = mode === "direct" ? selected.slice(0, 1) : selected;
  if (!memberIds.length) return { error: "member_required" };
  const { data: groupId, error } = await supabase.rpc("create_chat_group", { p_name: name, p_member_ids: memberIds });
  if (error) return { error: error.message };
  if (!groupId) return { error: "chat_create_failed" };
  revalidatePath("/chat");
  return { ok: Date.now(), groupId };
}

export async function updateChatGroup(prevState, formData) {
  const { supabase, user, profile } = await requireProfile();
  const groupId = clean(formData.get("group_id"));
  const name = clean(formData.get("name"));
  if (!groupId || !name) return { error: "missing" };
  const { data: membership } = await supabase.from("chat_group_members").select("is_admin").eq("group_id", groupId).eq("user_id", user.id).maybeSingle();
  if (!membership?.is_admin && profile.role !== "admin") return { error: "not_admin" };
  let avatarUrl;
  try { avatarUrl = await uploadChatImage(supabase, user.id, formData.get("avatar")); } catch (error) { return { error: error.message }; }
  const patch = { name };
  if (avatarUrl) patch.avatar_url = avatarUrl;
  const { error } = await supabase.from("chat_groups").update(patch).eq("id", groupId);
  if (error) return { error: error.message };
  revalidatePath("/chat");
  return { ok: Date.now() };
}

export async function changeChatMember(groupId, userId, action) {
  const { supabase } = await requireProfile();
  let result;
  if (action === "add") result = await supabase.from("chat_group_members").upsert({ group_id: groupId, user_id: userId, is_admin: false }, { onConflict: "group_id,user_id" });
  if (action === "remove") result = await supabase.from("chat_group_members").delete().eq("group_id", groupId).eq("user_id", userId);
  if (action === "admin") result = await supabase.from("chat_group_members").update({ is_admin: true }).eq("group_id", groupId).eq("user_id", userId);
  if (!result) return { error: "invalid_action" };
  if (result.error) return { error: result.error.message };
  revalidatePath("/chat");
  return { ok: true };
}

export async function leaveChat(groupId) {
  const { supabase, user } = await requireProfile();
  const { error } = await supabase.from("chat_group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

export async function openEventChat(eventId, eventName) {
  const { supabase, user } = await requireProfile();
  await supabase.rpc("join_default_chat_groups");
  const { data: existing } = await supabase.from("chat_groups").select("id").eq("kind", "event").eq("event_id", eventId).maybeSingle();
  if (existing?.id) return { ok: true, groupId: existing.id };
  const id = crypto.randomUUID();
  const { error } = await supabase.from("chat_groups").insert({ id, name: clean(eventName) || "Event", kind: "event", event_id: eventId, created_by: user.id });
  if (error && error.code !== "23505") return { error: error.message };
  if (!error) await supabase.from("chat_group_members").insert({ group_id: id, user_id: user.id, is_admin: false });
  await supabase.rpc("join_default_chat_groups");
  if (error?.code === "23505") {
    const { data: reused } = await supabase.from("chat_groups").select("id").eq("kind", "event").eq("event_id", eventId).maybeSingle();
    return reused?.id ? { ok: true, groupId: reused.id } : { error: error.message };
  }
  revalidatePath("/chat");
  return { ok: true, groupId: id };
}
