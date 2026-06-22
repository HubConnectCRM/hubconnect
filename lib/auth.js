import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

// Server-side guard: ensures Supabase is configured and a user is signed in,
// then returns the client, the auth user, and the matching profile row.
export async function requireProfile() {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    user,
    profile: profile || {
      id: user.id,
      email: user.email,
      full_name: user.email,
      role: "sales",
    },
  };
}
