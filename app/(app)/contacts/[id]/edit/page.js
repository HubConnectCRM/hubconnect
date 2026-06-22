import { notFound } from "next/navigation";
import ContactForm from "@/components/ContactForm";
import { getContactFormOptions } from "@/lib/options";

export default async function EditContactPage({ params }) {
  const { id } = await params;
  const { supabase, companies, owners, userId } = await getContactFormOptions();
  const { data } = await supabase
    .from("contacts")
    .select("*, company:companies(id, name)")
    .eq("id", id)
    .single();
  if (!data) notFound();
  return (
    <ContactForm
      contact={data}
      companies={companies}
      owners={owners}
      currentUserId={userId}
    />
  );
}
