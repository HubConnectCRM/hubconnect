"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

function clean(v) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

function canManageSales(profile) {
  return profile?.role === "admin" || profile?.role === "sales";
}

const salesDenied = () => ({ error: "sales_read_only" });

function revalidateScope(eventId, leadFileId) {
  if (eventId) revalidatePath(`/cost?event=${eventId}`);
  if (leadFileId) revalidatePath(`/cost?leadFile=${leadFileId}`);
}

export async function addCostItem(prevState, formData) {
  const { supabase, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();

  const eventId = clean(formData.get("event_id"));
  const leadFileId = clean(formData.get("lead_file_id"));
  if (!eventId && !leadFileId) return { error: "scope_required" };

  const description = clean(formData.get("description"));
  if (!description) return { error: "description_required" };

  const imponibile = Number(clean(formData.get("imponibile")) || 0);
  const iva = Number(clean(formData.get("iva")) || 0);

  let receiptPath = null;
  const file = formData.get("receipt");
  if (file && typeof file === "object" && file.size > 0) {
    const path = `${eventId || leadFileId}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("cost-receipts").upload(path, file, { contentType: file.type, upsert: false });
    if (!uploadError) receiptPath = path;
  }

  const { error } = await supabase.from("cost_items").insert({
    event_id: eventId,
    lead_file_id: leadFileId,
    description,
    imponibile,
    iva,
    receipt_path: receiptPath,
  });
  if (error) return { error: error.message };

  revalidateScope(eventId, leadFileId);
  return { ok: Date.now() };
}

export async function deleteCostItem(id, eventId, leadFileId) {
  const { supabase, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
  await supabase.from("cost_items").delete().eq("id", id);
  revalidateScope(eventId, leadFileId);
  return { ok: true };
}

export async function toggleCostItemPaid(id, paid, eventId, leadFileId) {
  const { supabase, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
  await supabase.from("cost_items").update({ paid }).eq("id", id);
  revalidateScope(eventId, leadFileId);
  return { ok: true };
}
