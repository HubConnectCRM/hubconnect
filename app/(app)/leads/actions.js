"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";

function clean(v) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

function canManageSales(profile) {
  return profile?.role === "admin" || profile?.role === "sales";
}

const salesDenied = () => ({ error: "sales_read_only" });

export async function saveLeadFile(prevState, formData) {
  const { supabase, user, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
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
  const { supabase, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
  await supabase.from("lead_files").delete().eq("id", id);
  revalidatePath("/leads");
  redirect("/leads");
}

export async function linkLeadFileToEvent(prevState, formData) {
  const { supabase, user, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
  const leadFileId = clean(formData.get("lead_file_id"));
  if (!leadFileId) return { error: "missing" };

  const linkedEventId = clean(formData.get("linked_event_id"));
  const status = clean(formData.get("status")) || "draft";
  const { error } = await supabase
    .from("lead_files")
    .update({
      linked_event_id: linkedEventId,
      status,
      approval_status: status,
      approved_at: status === "approved" ? new Date().toISOString() : null,
      approved_by: status === "approved" ? user.id : null,
    })
    .eq("id", leadFileId);
  if (error) return { error: error.message };

  revalidatePath(`/leads/${leadFileId}`);
  revalidatePath("/events");
  return { ok: Date.now() };
}

export async function addLeadContact(prevState, formData) {
  const { supabase, user, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
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
  const { supabase, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
  await supabase.from("lead_contacts").delete().eq("id", id);
  revalidatePath(`/leads/${leadFileId}`);
}

export async function updateLeadContact(id, updates, leadFileId) {
  const { supabase, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
  await supabase.from("lead_contacts").update(updates).eq("id", id);
  revalidatePath(`/leads/${leadFileId}`);
}

export async function setLeadPipelineStage(leadId, stage, leadFileId) {
  const { supabase, user, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
  const value = Number(stage);
  if (!leadId || !Number.isInteger(value) || value < 0 || value > 6) return { error: "invalid_stage" };

  const { error } = await supabase.from("lead_contacts").update({ pipeline_stage: value }).eq("id", leadId);
  if (error) return { error: error.message };
  const { error: timelineError } = await supabase.from("lead_pipeline_events").insert({ lead_id: leadId, stage: value, changed_by: user.id });
  if (timelineError) return { error: timelineError.message };
  revalidatePath(`/leads/${leadFileId}`);
  return { ok: Date.now() };
}


async function resolveCompanyByName(supabase, name, userId) {
  const companyName = clean(name);
  if (!companyName) return null;
  const norm = companyName.toLowerCase();
  const { data: existing } = await supabase
    .from("companies")
    .select("id")
    .eq("name_normalized", norm)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await supabase
    .from("companies")
    .insert({ name: companyName, created_by: userId })
    .select("id")
    .single();
  if (error) throw error;
  return created?.id ?? null;
}

function splitFullName(fullName) {
  const parts = (clean(fullName) || "").split(/\s+/).filter(Boolean);
  const first_name = parts.shift() || null;
  const last_name = parts.join(" ") || null;
  return { first_name, last_name };
}

export async function updateLeadPerson(prevState, formData) {
  const { supabase, user, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
  const leadFileId = clean(formData.get("lead_file_id"));
  const leadContactId = clean(formData.get("lead_contact_id"));
  const contactId = clean(formData.get("contact_id"));
  if (!leadFileId || !leadContactId || !contactId) return { error: "missing" };

  let companyId = clean(formData.get("company_id"));
  const companyName = clean(formData.get("company_name"));
  if (companyName) {
    try { companyId = await resolveCompanyByName(supabase, companyName, user.id); }
    catch (e) { return { error: e.message }; }
  }

  const { first_name, last_name } = splitFullName(formData.get("full_name"));
  if (!first_name) return { error: "name_required" };

  const contactPatch = {
    first_name,
    last_name,
    job_title: clean(formData.get("job_title")),
    email: clean(formData.get("email")),
    phone: clean(formData.get("phone")),
    linkedin: clean(formData.get("linkedin")),
    source: clean(formData.get("source")),
    notes: clean(formData.get("contact_notes")),
    company_id: companyId || null,
  };
  const ownerId = clean(formData.get("owner_id"));
  if (ownerId) contactPatch.owner_id = ownerId;

  const { error: contactError } = await supabase.from("contacts").update(contactPatch).eq("id", contactId);
  if (contactError) return { error: contactError.message };

  // Fetched before the update so we can tell whether feedback/next-step/price
  // actually changed (mirrors HubConnect iOS's updateEventLead) — only a real
  // change should create a Journal entry, not every unrelated field edit on
  // this same form.
  const { data: previousLead } = await supabase.from("lead_contacts").select("notes, next_step, estimated_value").eq("id", leadContactId).maybeSingle();

  const newNotes = clean(formData.get("lead_notes"));
  const newNextStep = clean(formData.get("next_step"));
  const newEstimatedValue = Number(clean(formData.get("estimated_value")) || 0);
  const newVatRate = Number(clean(formData.get("vat_rate")) ?? 20);

  const { error: leadError } = await supabase.from("lead_contacts").update({
    group_id: clean(formData.get("group_id")) || null,
    status: clean(formData.get("status")),
    rsvp: clean(formData.get("rsvp")),
    notes: newNotes,
    probability: clean(formData.get("probability")) || "T50",
    reconnect_at: clean(formData.get("reconnect_at")),
    next_step: newNextStep,
    estimated_value: newEstimatedValue,
    vat_rate: newVatRate,
    owner_id: ownerId || user.id,
  }).eq("id", leadContactId);
  if (leadError) return { error: leadError.message };

  // A deal may already exist for this lead (created earlier via "Mark won"/
  // "Opportunity") — its offer_value/iva were only a snapshot taken at that
  // moment, so a later price/VAT edit here must also push forward into the
  // deal, otherwise Sales and the Cost sheet keep showing a stale amount.
  if (companyId) {
    const newIva = newEstimatedValue * (newVatRate / 100);
    await supabase
      .from("deals")
      .update({ offer_value: newEstimatedValue, iva: newIva })
      .eq("lead_file_id", leadFileId)
      .eq("company_id", companyId);
  }

  const feedbackChanged = (previousLead?.notes || null) !== newNotes;
  const nextStepChanged = (previousLead?.next_step || null) !== newNextStep;
  const priceChanged = Number(previousLead?.estimated_value || 0) !== newEstimatedValue;
  const fullName = [first_name, last_name].filter(Boolean).join(" ");
  if ((feedbackChanged || nextStepChanged) && (newNotes || newNextStep)) {
    const noteBody = [newNotes, newNextStep].filter(Boolean).join(" · Next step: ");
    await supabase.from("journal_entries").insert({ owner_id: user.id, kind: "lead_update", title: fullName, note: noteBody, linked_contact_id: contactId });
  }
  if (priceChanged) {
    const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(newEstimatedValue);
    await supabase.from("journal_entries").insert({
      owner_id: user.id, kind: "lead_update", title: fullName,
      note: `Fiyat güncellendi: ${eur}`, linked_contact_id: contactId,
    });
  }

  revalidatePath(`/leads/${leadFileId}`);
  revalidatePath("/contacts");
  revalidatePath("/companies");
  revalidatePath("/journal");
  return { ok: Date.now() };
}

export async function createOpportunityFromLeadContact(prevState, formData) {
  const { supabase, user, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
  const leadFileId = clean(formData.get("lead_file_id"));
  const contactId = clean(formData.get("contact_id"));
  const companyId = clean(formData.get("company_id"));
  const companyName = clean(formData.get("company_name"));
  const stage = clean(formData.get("stage")) || "prospect";
  if (!leadFileId || !contactId || (!companyId && !companyName)) return { error: "missing" };

  // The lead's own Estimated Value (lead_contacts.estimated_value) is the
  // only price ever entered for this lead — it must carry over as the
  // deal's offer_value, otherwise every deal born from a lead conversion
  // shows €0 revenue everywhere that reads offer_value (Sales pipeline, and
  // the Cost/Bilancino sheet's auto-synced RICAVI rows). Same for the VAT
  // choice made on the lead (vat_rate: 0 or 20) — stored as an actual amount
  // on the deal (deals.iva) so Cost's RICAVI row uses the real tax instead
  // of assuming a fixed rate.
  const offerValue = Number(clean(formData.get("estimated_value")) || 0);
  const vatRate = Number(clean(formData.get("vat_rate")) ?? 20);
  const iva = offerValue * (vatRate / 100);

  let finalCompanyId = companyId;
  if (!finalCompanyId && companyName) {
    try { finalCompanyId = await resolveCompanyByName(supabase, companyName, user.id); }
    catch (e) { return { error: e.message }; }
  }

  const { data: existingDeal } = await supabase
    .from("deals")
    .select("id, stage, won_at")
    .eq("lead_file_id", leadFileId)
    .eq("company_id", finalCompanyId)
    .limit(1)
    .maybeSingle();

  let dealId = existingDeal?.id;
  if (!dealId) {
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .insert({
        lead_file_id: leadFileId,
        company_id: finalCompanyId,
        company_name: companyName,
        owner_id: clean(formData.get("owner_id")) || user.id,
        stage,
        po_won: stage === "won",
        offer_value: offerValue,
        iva,
        // won_at is the stable date shown/filtered on the Sales page — unlike
        // updated_at it's only touched at the moment a deal actually becomes won.
        won_at: stage === "won" ? new Date().toISOString() : null,
        notes: clean(formData.get("notes")),
        created_by: user.id,
      })
      .select("id")
      .single();
    if (dealError) return { error: dealError.message };
    dealId = deal.id;
  } else {
    const patch = { stage, offer_value: offerValue, iva };
    if (stage === "won") {
      patch.po_won = true;
      if (existingDeal.stage !== "won" || !existingDeal.won_at) patch.won_at = new Date().toISOString();
    } else {
      patch.won_at = null;
    }
    await supabase.from("deals").update(patch).eq("id", dealId);
  }

  const { error: repError } = await supabase.from("deal_reps").upsert({
    deal_id: dealId,
    contact_id: contactId,
    rsvp: clean(formData.get("rsvp")) || null,
  }, { onConflict: "deal_id,contact_id" });
  if (repError) return { error: repError.message };

  await supabase.from("lead_contacts").update({ status: stage === "won" ? "won" : "opportunity" }).eq("lead_file_id", leadFileId).eq("contact_id", contactId);

  revalidatePath(`/leads/${leadFileId}`);
  revalidatePath("/sales");
  return { ok: Date.now(), dealId, stage };
}

export async function renameGroup(id, name, revalidate) {
  const { supabase, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
  await supabase.from("contact_groups").update({ name }).eq("id", id);
  if (revalidate) revalidatePath(revalidate);
}

export async function addLeadGroup(prevState, formData) {
  const { supabase, user, profile } = await requireProfile();
  if (!canManageSales(profile)) return salesDenied();
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
