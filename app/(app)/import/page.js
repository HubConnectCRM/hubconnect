import { requireProfile } from "@/lib/auth";
import ImportWizard from "@/components/ImportWizard";

export default async function ImportPage({ searchParams }) {
  const sp = await searchParams;
  const { supabase } = await requireProfile();
  const [{ data: emails }, { data: leadFiles }, { data: events }, { data: owners }] = await Promise.all([
    supabase
      .from("contacts")
      .select("email_normalized")
      .not("email_normalized", "is", null)
      .limit(20000),
    supabase.from("lead_files").select("id, name").order("name"),
    supabase.from("events").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);
  const existingEmails = (emails || []).map((d) => d.email_normalized);
  return <ImportWizard existingEmails={existingEmails} leadFiles={leadFiles || []} events={events || []} owners={owners || []} defaultLeadFileId={sp?.leadFileId || ""} defaultDestination={sp?.destination || ""} />;
}
