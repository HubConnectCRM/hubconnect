import { requireProfile } from "@/lib/auth";
import JournalView from "@/components/JournalView";

export default async function JournalPage() {
  const { supabase, user } = await requireProfile();
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("id, kind, title, note, due_at, completed, linked_contact_id, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(500);

  return <JournalView entries={entries || []} />;
}
