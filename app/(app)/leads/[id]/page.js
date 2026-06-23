import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import LeadFileDetail from "@/components/LeadFileDetail";

export default async function LeadFilePage({ params }) {
  const { id } = await params;
  const { supabase } = await requireProfile();

  const [{ data: file }, { data: lcRows }, { data: groups }, { data: contacts }] =
    await Promise.all([
      supabase.from("lead_files").select("*").eq("id", id).single(),
      supabase
        .from("lead_contacts")
        .select(
          "id, status, notes, rsvp, created_at, group_id, contact:contacts(id, full_name, email, phone, job_title, linkedin, company:companies(name), owner:profiles!contacts_owner_id_fkey(id, full_name, email))"
        )
        .eq("lead_file_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_groups")
        .select("id, name")
        .eq("lead_file_id", id)
        .order("created_at"),
      supabase
        .from("contacts")
        .select("id, full_name, company:companies(name)")
        .order("full_name")
        .limit(5000),
    ]);

  if (!file) notFound();

  return (
    <LeadFileDetail
      file={file}
      leadContacts={lcRows || []}
      groups={groups || []}
      contacts={contacts || []}
    />
  );
}
