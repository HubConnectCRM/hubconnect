import AppShell from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";

export default async function AppLayout({ children }) {
  const { profile } = await requireProfile();
  return <AppShell profile={profile}>{children}</AppShell>;
}
