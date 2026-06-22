import { requireProfile } from "@/lib/auth";

// Shared lookups for contact/event forms: companies + active team members.
export async function getContactFormOptions() {
  const { supabase, user } = await requireProfile();
  const [{ data: companies }, { data: owners }] = await Promise.all([
    supabase.from("companies").select("id, name").order("name").limit(5000),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name"),
  ]);
  return {
    supabase,
    userId: user.id,
    companies: companies || [],
    owners: owners || [],
  };
}
