import { requireProfile } from "@/lib/auth";
import NotificationsView from "@/components/NotificationsView";

export default async function NotificationsPage() {
  await requireProfile();
  return <NotificationsView />;
}
