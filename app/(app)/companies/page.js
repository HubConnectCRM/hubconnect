import { requireProfile } from "@/lib/auth";
import CompaniesList from "@/components/CompaniesList";

export default async function CompaniesPage() {
  const { supabase } = await requireProfile();

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, sector, country, city, contacts(count)")
    .order("name", { ascending: true })
    .limit(5000);

  const rows = (companies || []).map((c) => ({
    id: c.id,
    name: c.name,
    sector: c.sector,
    location: [c.city, c.country].filter(Boolean).join(", "),
    contactCount: c.contacts?.[0]?.count ?? 0,
  }));

  return <CompaniesList companies={rows} />;
}
