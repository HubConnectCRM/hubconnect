import { requireProfile } from "@/lib/auth";
import DashboardView from "@/components/DashboardView";

export default async function DashboardPage() {
  const { supabase, profile } = await requireProfile();

  const [contacts, companies, events, leads, deals] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase.from("companies").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("lead_files").select("*", { count: "exact", head: true }),
    supabase.from("deals").select("*", { count: "exact", head: true }),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const { data: followups } = await supabase
    .from("interactions")
    .select("id, next_step, next_step_due, contact:contacts(id, full_name)")
    .gte("next_step_due", today)
    .order("next_step_due", { ascending: true })
    .limit(6);

  const stats = {
    contacts: contacts.count || 0,
    companies: companies.count || 0,
    events: events.count || 0,
    leads: leads.count || 0,
    deals: deals.count || 0,
  };

  return (
    <DashboardView
      name={profile?.full_name || profile?.email}
      stats={stats}
      followups={followups || []}
    />
  );
}
