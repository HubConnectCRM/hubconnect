import { requireProfile } from "@/lib/auth";
import SalesView from "@/components/SalesView";

export default async function SalesPage() {
  const { supabase, profile } = await requireProfile();

  const [
    { data: deals, error: dealsError },
    { data: wonLeadContacts, error: wonLeadsError },
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
        "id, company_name, stage, po_won, pushed_event_id, group_id, owner_id, lead_file_id, created_at, updated_at, won_at, company:companies(id, name), owner:profiles!deals_owner_id_fkey(id, full_name, email), lead_file:lead_files(id, name), pushed_event:events!deals_pushed_event_id_fkey(id, name), group:contact_groups(name), reps:deal_reps(id, rsvp, notes, contact:contacts(id, full_name, email, phone, job_title))"
      )
      .or("stage.eq.won,po_won.eq.true,pushed_event_id.not.is.null")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase
      .from("lead_contacts")
      .select("id, lead_file_id, owner_id, group_id, status, probability, created_at, owner:profiles!lead_contacts_owner_id_fkey(id, full_name, email), lead_file:lead_files(id, name), contact:contacts(id, full_name, email, phone, job_title, company:companies(id, name, website, overview))")
      .eq("status", "won")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
    supabase.from("events").select("id, name").order("name"),
    supabase.from("lead_files").select("id, name").order("name"),
    supabase.from("companies").select("id, name, website, overview").order("name").limit(5000),
    Promise.resolve({ data: [] }),
    supabase.from("contact_groups").select("id, name, lead_file_id").order("name"),
  ]);

  const wonDeals = [...(deals || [])];
  const existingKeys = new Set(wonDeals.map((deal) => `${deal.lead_file_id || ""}:${deal.company?.id || deal.company_name || ""}`));
  for (const row of wonLeadContacts || []) {
    const company = row.contact?.company || null;
    const key = `${row.lead_file_id || ""}:${company?.id || company?.name || row.contact?.id || ""}`;
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    wonDeals.push({
      id: `lead-${row.id}`,
      synthetic: true,
      company_name: company?.name || row.contact?.full_name || "Won lead",
      company,
      stage: "won",
      po_won: true,
      pushed_event_id: null,
      group_id: row.group_id,
      owner_id: row.owner_id,
      lead_file_id: row.lead_file_id,
      created_at: row.created_at,
      updated_at: row.created_at,
      won_at: row.created_at,
      owner: row.owner,
      lead_file: row.lead_file,
      reps: row.contact ? [{ id: `lead-rep-${row.id}`, rsvp: null, notes: row.probability || "", contact: row.contact }] : [],
    });
  }
  wonDeals.sort((a, b) => new Date(b.won_at || b.updated_at || b.created_at) - new Date(a.won_at || a.updated_at || a.created_at));
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
      loadError={dealsError?.message || wonLeadsError?.message || null}
      canEdit={profile.role === "admin" || profile.role === "sales"}
    />
  );
}
