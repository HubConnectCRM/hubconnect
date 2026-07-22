import { requireProfile } from "@/lib/auth";
import MailCenterView from "@/components/MailCenterView";
import { decodeMailbosKey, fetchMailbosInbox, fetchMailbosSent } from "@/lib/mailbos";

export default async function MailCenterPage({ searchParams }) {
  const params = await searchParams;
  const { supabase, profile } = await requireProfile();

  const apiKey = decodeMailbosKey(profile.mailbos_api_key_enc);
  const connected = !!apiKey;
  const provider = profile.mailbos_provider || "gmail";
  let messages = [];
  let inbox = [];
  let liveError = null;

  if (connected) {
    try {
      [messages, inbox] = await Promise.all([
        fetchMailbosSent(apiKey),
        fetchMailbosInbox(apiKey, provider),
      ]);
    } catch (error) {
      liveError = error.message || "mailbos_unreachable";
      const { data: stored } = await supabase
        .from("mail_messages")
        .select("id, provider_message_id, to_emails, subject, body_preview, replied, sent_at, contact:contacts(id, full_name)")
        .eq("direction", "sent")
        .order("sent_at", { ascending: false })
        .limit(100);
      messages = (stored || []).map((message) => ({
        id: message.id,
        provider,
        to_email: message.to_emails?.[0] || "",
        subject: message.subject || "",
        body_preview: message.body_preview || "",
        tracking_id: message.provider_message_id,
        opened: false,
        replied: message.replied || false,
        sent_at: message.sent_at,
        contact: message.contact,
      }));
    }
  }

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, full_name, email, company:companies(name)")
    .not("email", "is", null)
    .order("full_name")
    .limit(3000);

  return (
    <MailCenterView
      connected={connected}
      senderEmail={profile.mailbos_sender_email || null}
      provider={provider}
      messages={messages || []}
      inbox={inbox || []}
      contacts={contacts || []}
      liveError={liveError}
      initialRecipient={params?.to || ""}
      mailbosKeyId={profile.mailbos_key_id || ""}
    />
  );
}
