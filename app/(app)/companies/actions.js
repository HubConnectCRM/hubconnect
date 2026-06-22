"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function clean(v) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

export async function saveCompany(prevState, formData) {
  const { supabase, user } = await requireProfile();

  const id = clean(formData.get("id"));
  const name = clean(formData.get("name"));
  if (!name) return { error: "name_required" };

  const row = {
    name,
    sector: clean(formData.get("sector")),
    country: clean(formData.get("country")),
    city: clean(formData.get("city")),
    website: clean(formData.get("website")),
    overview: clean(formData.get("overview")),
  };

  let companyId = id;
  if (id) {
    const { error } = await supabase.from("companies").update(row).eq("id", id);
    if (error) return { error: error.message };
  } else {
    row.created_by = user.id;
    const { data, error } = await supabase
      .from("companies")
      .insert(row)
      .select("id")
      .single();
    if (error) return { error: error.message };
    companyId = data.id;
  }

  revalidatePath("/companies");
  redirect(`/companies/${companyId}`);
}

export async function deleteCompany(id) {
  const { supabase } = await requireProfile();
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/companies");
  redirect("/companies");
}
