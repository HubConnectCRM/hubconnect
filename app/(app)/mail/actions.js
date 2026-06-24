"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";

function clean(v) {
  const s = (v ?? "").toString().trim();
  return s === "" ? null : s;
}

export async function sendWithMailbos(prevState, formData) {
  const { supabase, user, profile } = await requireProfile();

  const keyEnc = profile.mailbos_api_key_enc;
  if (!keyEnc) return { error: "not_connected" };

  const apiKey = Buffer.from(keyEnc, "base64").toString("utf8");
  const to = clean(formData.get("to"));
  const subject = clean(formData.get("subject"));
  const body = clean(formData.get("body"));
  const contactId = clean(formData.get("contact_id")) || null;
  const dealId = clean(formData.get("deal_id")) || null;

  if (!to || !subject || !body) return { error: "missing_fields" };

  let trackingId = null;
  try {
    const res = await fetch("https://app.mailbos.app/api/ext/v1/send", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body, track: true }),
    });
    const data = await res.json();
    if (!data.ok) return { error: data.error || "send_failed" };
    trackingId = data.trackingId || null;
  } catch {
    return { error: "mailbos_unreachable" };
  }

  // Record in mail_messages
  await supabase.from("mail_messages").insert({
    user_id: user.id,
    contact_id: contactId,
    deal_id: dealId,
    to_email: to,
    subject,
    body_preview: body.slice(0, 200),
    tracking_id: trackingId,
    provider: "mailbos",
  });

  revalidatePath("/mail");
  if (contactId) revalidatePath(`/contacts/${contactId}`);
  return { ok: true, trackingId };
}
