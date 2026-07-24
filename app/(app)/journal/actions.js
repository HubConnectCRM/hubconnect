"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

function clean(value) {
  const result = (value ?? "").toString().trim();
  return result || null;
}

export async function addJournalTask(prevState, formData) {
  const { supabase, user } = await requireProfile();
  const title = clean(formData.get("title"));
  if (!title) return { error: "title_required" };
  const dueAt = clean(formData.get("due_at"));

  const { error } = await supabase.from("journal_entries").insert({
    owner_id: user.id,
    kind: "task",
    title,
    note: clean(formData.get("note")) || "",
    due_at: dueAt ? new Date(dueAt).toISOString() : null,
  });
  if (error) return { error: error.message };
  revalidatePath("/journal");
  revalidatePath("/calendar");
  return { ok: Date.now() };
}

export async function toggleJournalTask(id, completed) {
  const { supabase, user } = await requireProfile();
  const { error } = await supabase.from("journal_entries").update({ completed }).eq("id", id).eq("owner_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/journal");
  revalidatePath("/calendar");
  return { ok: true };
}
