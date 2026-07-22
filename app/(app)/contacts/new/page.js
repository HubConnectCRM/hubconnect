import ContactForm from "@/components/ContactForm";
import { getContactFormOptions } from "@/lib/options";

export default async function NewContactPage({ searchParams }) {
  const { companies, owners, userId } = await getContactFormOptions();
  const { companyId } = await searchParams;
  const defaultCompany = companies.find((company) => company.id === companyId);
  return (
    <ContactForm companies={companies} owners={owners} currentUserId={userId} defaultCompanyName={defaultCompany?.name || ""} />
  );
}
