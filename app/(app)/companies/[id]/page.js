import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import CompanyDetail from "@/components/CompanyDetail";

export default async function CompanyPage({ params }) {
  const { id } = await params;
  const { supabase } = await requireProfile();

  const { data: company } = await supabase
    .from("companies")
    .select(
      "id, name, sector, country, city, website, overview, contacts(id, full_name, job_title, email)"
    )
    .eq("id", id)
    .single();

  if (!company) notFound();

  return <CompanyDetail company={company} />;
}
