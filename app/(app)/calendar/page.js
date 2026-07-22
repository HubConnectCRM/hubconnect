import { requireProfile } from "@/lib/auth";
import TeamCalendarView from "@/components/TeamCalendarView";

export default async function CalendarPage() {
  const { supabase, user, profile } = await requireProfile();
  const from = new Date();
  from.setDate(from.getDate() - 30);

  const [{ data: meetings }, { data: teammates }, { data: contacts }] = await Promise.all([
    supabase
      .from("meetings")
      .select("id, owner_id, contact_id, title, meeting_link, location, start_at, end_at, note, owner:profiles(id, full_name, email), contact:contacts(id, full_name, email, company:companies(name))")
      .gte("start_at", from.toISOString())
      .order("start_at")
      .limit(5000),
    supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name"),
    supabase.from("contacts").select("id, full_name, email, company:companies(name)").order("full_name").limit(3000),
  ]);

  return <TeamCalendarView meetings={meetings || []} teammates={teammates || []} contacts={contacts || []} currentUserId={user.id} isAdmin={profile.role === "admin"} />;
}
