import { requireProfile } from "@/lib/auth";
import DashboardView from "@/components/DashboardView";

export default async function DashboardPage() {
  const { supabase, profile } = await requireProfile();

  const today = new Date().toISOString().slice(0, 10);
  const [contacts, companies, events, leads, deals, activePipeline, wonDeals, upcomingEvents, leadFollowups, recentActivity] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase.from("companies").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("lead_files").select("*", { count: "exact", head: true }),
    supabase.from("deals").select("*", { count: "exact", head: true }),
    supabase.from("deals").select("id, offer_value, stage", { count: "exact" }).eq("owner_id", profile.id).in("stage", ["prospect", "contacted", "in_progress", "proposal"]),
    supabase.from("deals").select("*", { count: "exact", head: true }).eq("owner_id", profile.id).eq("stage", "won"),
    supabase.from("events").select("id, name, location, venue_name, start_date, status, prospect_number").gte("start_date", today).neq("status", "cancelled").order("start_date").limit(4),
    supabase.from("lead_contacts").select("id, probability, reconnect_at, next_step, contact:contacts(full_name, company:companies(name))").eq("owner_id", profile.id).not("reconnect_at", "is", null).gte("reconnect_at", new Date(Date.now() - 86400000).toISOString()).order("reconnect_at").limit(6),
    supabase.from("audit_log").select("id, table_name, action, changed_at").eq("user_id", profile.id).order("changed_at", { ascending: false }).limit(6),
  ]);

  const { data: followups } = await supabase
    .from("interactions")
    .select("id, next_step, next_step_due, type, contact:contacts(id, full_name)")
    .eq("user_id", profile.id)
    .gte("next_step_due", today)
    .order("next_step_due", { ascending: true })
    .limit(6);

  const stats = {
    contacts: contacts.count || 0,
    companies: companies.count || 0,
    events: events.count || 0,
    leads: leads.count || 0,
    deals: deals.count || 0,
    activePipeline: activePipeline.count || activePipeline.data?.length || 0,
    activePipelineValue: (activePipeline.data || []).reduce((total, deal) => total + Number(deal.offer_value || 0), 0),
    won: wonDeals.count || 0,
  };

  return (
    <DashboardView
      name={profile?.full_name || profile?.email}
      stats={stats}
      followups={followups || []}
      leadFollowups={leadFollowups.data || []}
      upcomingEvents={upcomingEvents.data || []}
      recentActivity={recentActivity.data || []}
    />
  );
}
