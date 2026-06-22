import ContactForm from "@/components/ContactForm";
import { getContactFormOptions } from "@/lib/options";

export default async function NewContactPage() {
  const { companies, owners, userId } = await getContactFormOptions();
  return (
    <ContactForm companies={companies} owners={owners} currentUserId={userId} />
  );
}
