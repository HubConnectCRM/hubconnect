import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import AuditLog from "@/components/AuditLog";

export default async function AuditPage() {
  const { supabase, profile } = await requireProfile();
  if (profile.role !== "admin") redirect("/dashboard");

  const [{ data: logs }, { data: profiles }] = await Promise.all([
    supabase
      .from("audit_log")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(200),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  return <AuditLog logs={logs || []} profiles={profiles || []} />;
}
