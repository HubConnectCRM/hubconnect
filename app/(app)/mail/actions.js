"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { decodeMailbosKey, fetchMailbosMessage, mailbosRequest } from "@/lib/mailbos";

function clean(v) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

export async function sendWithMailbos(prevState, formData) {
  const { supabase, user, profile } = await requireProfile();

  const keyEnc = profile.mailbos_api_key_enc;
  if (!keyEnc) return { error: "not_connected" };

  const apiKey = decodeMailbosKey(keyEnc);
  const to = clean(formData.get("to"));
  const subject = clean(formData.get("subject"));
  const body = clean(formData.get("body"));
  const contactId = clean(formData.get("contact_id")) || null;
  const dealId = clean(formData.get("deal_id")) || null;

  if (!to || !subject || !body) return { error: "missing_fields" };

  let trackingId = null;
  try {
    const data = await mailbosRequest(apiKey, "/api/ext/v1/send", {
      method: "POST",
      body: {
        to,
        subject,
        body,
        provider: profile.mailbos_provider || "gmail",
        track: true,
      },
    });
    trackingId = data.trackingId || null;
  } catch (error) {
    return { error: error.message || "mailbos_unreachable" };
  }

  let resolvedContactId = contactId;
  let companyId = null;
  if (!resolvedContactId) {
    const { data: contact } = await supabase
      .from("contacts")
      .select("id, company_id")
      .eq("email_normalized", to.toLowerCase())
      .limit(1)
      .maybeSingle();
    resolvedContactId = contact?.id || null;
    companyId = contact?.company_id || null;
  } else {
    const { data: contact } = await supabase
      .from("contacts")
      .select("company_id")
      .eq("id", resolvedContactId)
      .maybeSingle();
    companyId = contact?.company_id || null;
  }

  // Keep a CRM copy in Supabase. iOS reads live MailBos data while the web app
  // also links each message to the shared contact/company/deal records.
  const providerMessageId = trackingId || `hubconnect-${randomUUID()}`;
  const { error: recordError } = await supabase.from("mail_messages").insert({
    provider_message_id: providerMessageId,
    direction: "sent",
    from_email: profile.mailbos_sender_email || user.email,
    to_emails: [to],
    contact_id: resolvedContactId,
    company_id: companyId,
    deal_id: dealId,
    subject,
    body_preview: body.slice(0, 200),
    sent_at: new Date().toISOString(),
    replied: false,
  });
  if (recordError) return { error: recordError.message };

  revalidatePath("/mail");
  if (resolvedContactId) revalidatePath(`/contacts/${resolvedContactId}`);
  return { ok: true, trackingId };
}

export async function getInboxMessage(id, provider) {
  const { profile } = await requireProfile();
  const apiKey = decodeMailbosKey(profile.mailbos_api_key_enc);
  if (!apiKey) return { error: "mailbos_not_connected" };
  try {
    const message = await fetchMailbosMessage(apiKey, id, provider || profile.mailbos_provider || "gmail");
    return {
      ok: true,
      message: {
        subject: message.subject || "",
        from: message.from || "",
        date: message.date || null,
        body: message.body || "",
      },
    };
  } catch (error) {
    return { error: error.message || "mailbos_unreachable" };
  }
}
