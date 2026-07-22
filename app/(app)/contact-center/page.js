import { requireProfile } from "@/lib/auth";
import ContactCenterHome from "@/components/ContactCenterHome";

export default async function ContactCenterPage() {
  const { supabase, user, profile } = await requireProfile();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [callsResult, meetingsResult, contactsResult] = await Promise.all([
    supabase
      .from("call_logs")
      .select("id", { count: "exact", head: true })
      .eq("logged_by", user.id)
      .gte("created_at", today.toISOString()),
    supabase
      .from("meetings")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .gte("start_at", today.toISOString())
      .lt("start_at", tomorrow.toISOString()),
    supabase.from("contacts").select("id", { count: "exact", head: true }),
  ]);

  return (
    <ContactCenterHome
      stats={{
        callsToday: callsResult.count || 0,
        meetingsToday: meetingsResult.count || 0,
        contacts: contactsResult.count || 0,
      }}
      mailbosConnected={!!profile.mailbos_api_key_enc}
      senderEmail={profile.mailbos_sender_email || null}
    />
  );
}
