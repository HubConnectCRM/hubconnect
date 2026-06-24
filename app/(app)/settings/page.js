import { requireProfile } from "@/lib/auth";
import SettingsView from "@/components/SettingsView";

export default async function SettingsPage() {
  const { supabase, profile } = await requireProfile();

  let users = [];
  if (profile.role === "admin") {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, is_active")
      .order("full_name");
    users = data || [];
  }

  return (
    <SettingsView
      profile={profile}
      users={users}
      isAdmin={profile.role === "admin"}
      mailbosSenderEmail={profile.mailbos_sender_email || null}
    />
  );
}
