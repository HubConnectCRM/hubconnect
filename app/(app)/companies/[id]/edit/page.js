import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import CompanyForm from "@/components/CompanyForm";

export default async function EditCompanyPage({ params }) {
  const { id } = await params;
  const { supabase } = await requireProfile();
  const { data } = await supabase.from("companies").select("*").eq("id", id).single();
  if (!data) notFound();
  return <CompanyForm company={data} />;
}
