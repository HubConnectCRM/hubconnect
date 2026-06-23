import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";

// Service-role client for privileged server-side ops (creating users).
// Never import this into client components — the key is server-only.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
