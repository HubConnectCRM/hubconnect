import { requireProfile } from "@/lib/auth";
import CallPicker from "@/components/calls/CallPicker";

export default async function CallsPage() {
  const { supabase, profile } = await requireProfile();
  const { data: teammates } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("is_active", true)
    .neq("id", profile.id)
    .order("full_name");

  return <CallPicker profile={profile} teammates={teammates || []} />;
}
