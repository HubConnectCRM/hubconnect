import { requireProfile } from "@/lib/auth";
import MailCenterView from "@/components/MailCenterView";

export default async function MailCenterPage() {
  const { supabase, profile } = await requireProfile();

  const connected = !!profile.mailbos_api_key_enc;

  const { data: messages } = connected
    ? await supabase
        .from("mail_messages")
        .select("id, to_email, subject, body_preview, tracking_id, opened, replied, sent_at, contact:contacts(id, full_name)")
        .order("sent_at", { ascending: false })
        .limit(100)
    : { data: [] };

  return (
    <MailCenterView
      connected={connected}
      senderEmail={profile.mailbos_sender_email || null}
      messages={messages || []}
    />
  );
}
