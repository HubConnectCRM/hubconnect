import { requireProfile } from "@/lib/auth";
import ImportWizard from "@/components/ImportWizard";

export default async function ImportPage() {
  const { supabase } = await requireProfile();
  const { data } = await supabase
    .from("contacts")
    .select("email_normalized")
    .not("email_normalized", "is", null)
    .limit(20000);
  const existingEmails = (data || []).map((d) => d.email_normalized);
  return <ImportWizard existingEmails={existingEmails} />;
}
