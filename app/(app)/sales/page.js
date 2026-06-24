import { requireProfile } from "@/lib/auth";
import SalesView from "@/components/SalesView";

export default async function SalesPage() {
  const { supabase } = await requireProfile();

  const [
    { data: deals },
    { data: owners },
    { data: events },
    { data: leadFiles },
    { data: companies },
    { data: contacts },
    { data: groups },
  ] = await Promise.all([
    supabase
      .from("deals")
      .select(
        "id, company_name, stage, po_won, pushed_event_id, group_id, owner_id, lead_file_id, created_at, company:companies(id, name), owner:profiles!deals_owner_id_fkey(id, full_name, email), lead_file:lead_files(id, name), pushed_event:events(id, name), group:contact_groups(name), reps:deal_reps(id, rsvp, notes, contact:contacts(id, full_name, email, phone, job_title))"
      )
      .or("stage.eq.won,po_won.eq.true,pushed_event_id.not.is.null")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    supabase.from("events").select("id, name").order("name"),
    supabase.from("lead_files").select("id, name").order("name"),
    supabase.from("companies").select("id, name, website, overview").order("name").limit(5000),
    Promise.resolve({ data: [] }),
    supabase.from("contact_groups").select("id, name, lead_file_id").order("name"),
  ]);

  const wonDeals = deals || [];
  const companyIds = new Set(wonDeals.map((d) => d.company?.id).filter(Boolean));
  const salesCompanies = (companies || []).filter((c) => companyIds.has(c.id));
  const repMap = new Map();
  for (const d of wonDeals) {
    for (const rep of d.reps || []) {
      if (rep.contact?.id && !repMap.has(rep.contact.id)) {
        repMap.set(rep.contact.id, { ...rep.contact, company: d.company || null });
      }
    }
  }

  return (
    <SalesView
      deals={wonDeals}
      owners={owners || []}
      events={events || []}
      leadFiles={leadFiles || []}
      companies={salesCompanies}
      contacts={Array.from(repMap.values())}
      groups={groups || []}
    />
  );
}
