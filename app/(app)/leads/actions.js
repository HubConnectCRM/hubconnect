"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function clean(v) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

export async function saveLeadFile(prevState, formData) {
  const { supabase, user } = await requireProfile();
  const id = clean(formData.get("id"));
  const name = clean(formData.get("name"));
  if (!name) return { error: "name_required" };

  const row = { name, description: clean(formData.get("description")) };

  let fileId = id;
  if (id) {
    const { error } = await supabase.from("lead_files").update(row).eq("id", id);
    if (error) return { error: error.message };
  } else {
    row.created_by = user.id;
    const { data, error } = await supabase
      .from("lead_files")
      .insert(row)
      .select("id")
      .single();
    if (error) return { error: error.message };
    fileId = data.id;

    // Create first group if provided
    const firstGroup = clean(formData.get("first_group"));
    if (firstGroup) {
      await supabase.from("contact_groups").insert({
        lead_file_id: fileId,
        name: firstGroup,
        created_by: user.id,
      });
    }
  }

  revalidatePath("/leads");
  redirect(`/leads/${fileId}`);
}

export async function deleteLeadFile(id) {
  const { supabase } = await requireProfile();
  await supabase.from("lead_files").delete().eq("id", id);
  revalidatePath("/leads");
  redirect("/leads");
}

export async function addLeadContact(prevState, formData) {
  const { supabase, user } = await requireProfile();
  const leadFileId = clean(formData.get("lead_file_id"));
  const contactId = clean(formData.get("contact_id"));
  if (!leadFileId || !contactId) return { error: "missing" };

  const { error } = await supabase.from("lead_contacts").insert({
    lead_file_id: leadFileId,
    contact_id: contactId,
    group_id: clean(formData.get("group_id")) || null,
    status: clean(formData.get("status")),
    notes: clean(formData.get("notes")),
    added_by: user.id,
  });
  if (error) {
    if (error.code === "23505") return { error: "already_added" };
    return { error: error.message };
  }
  revalidatePath(`/leads/${leadFileId}`);
  return { ok: Date.now() };
}

export async function removeLeadContact(id, leadFileId) {
  const { supabase } = await requireProfile();
  await supabase.from("lead_contacts").delete().eq("id", id);
  revalidatePath(`/leads/${leadFileId}`);
}

export async function updateLeadContact(id, updates, leadFileId) {
  const { supabase } = await requireProfile();
  await supabase.from("lead_contacts").update(updates).eq("id", id);
  revalidatePath(`/leads/${leadFileId}`);
}

export async function renameGroup(id, name, revalidate) {
  const { supabase } = await requireProfile();
  await supabase.from("contact_groups").update({ name }).eq("id", id);
  if (revalidate) revalidatePath(revalidate);
}

export async function addLeadGroup(prevState, formData) {
  const { supabase, user } = await requireProfile();
  const leadFileId = clean(formData.get("lead_file_id"));
  const name = clean(formData.get("name"));
  if (!leadFileId || !name) return { error: "missing" };
  const { error } = await supabase.from("contact_groups").insert({
    lead_file_id: leadFileId,
    name,
    created_by: user.id,
  });
  if (error) return { error: error.message };
  revalidatePath(`/leads/${leadFileId}`);
  return { ok: Date.now() };
}
