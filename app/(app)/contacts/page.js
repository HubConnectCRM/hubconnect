import { requireProfile } from "@/lib/auth";
import ContactsList from "@/components/ContactsList";

export default async function ContactsPage() {
  const { supabase } = await requireProfile();

  const [{ data: contacts }, { data: owners }] = await Promise.all([
    supabase
      .from("contacts")
      .select(
        "id, full_name, job_title, email, company:companies(id, name), owner:profiles!contacts_owner_id_fkey(id, full_name, email)"
      )
      .order("full_name", { ascending: true })
      .limit(5000),
    supabase.from("profiles").select("id, full_name, email").order("full_name"),
  ]);

  const rows = (contacts || []).map((c) => ({
    id: c.id,
    name: c.full_name || "—",
    jobTitle: c.job_title,
    email: c.email,
    companyName: c.company?.name || "",
    ownerId: c.owner?.id || "",
    ownerName: c.owner?.full_name || c.owner?.email || "",
  }));

  return <ContactsList contacts={rows} owners={owners || []} />;
}
