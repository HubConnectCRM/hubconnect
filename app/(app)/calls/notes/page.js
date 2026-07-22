import { requireProfile } from "@/lib/auth";
import CallNotesView from "@/components/calls/CallNotesView";

export default async function CallNotesPage() {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase
    .from("call_notes")
    .select(
      "id, room_id, user_id, note, summary, with_names, created_at, author:profiles(full_name, email), room:call_rooms(kind, status, created_at)"
    )
    .order("created_at", { ascending: false })
    .limit(500);

  return <CallNotesView notes={data || []} loadError={error?.message || null} />;
}
