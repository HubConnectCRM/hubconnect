import { requireProfile } from "@/lib/auth";
import { Card, PageHeader, Badge } from "@/components/ui";

export default async function NotificationsPage() {
  await requireProfile();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Notifications" subtitle="Follow-up reminders, reply alerts and event/sales handoff tasks." />
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2"><Badge color="amber">Next phase</Badge><span className="text-sm text-[var(--muted)]">Schema is included; live notifications need Outlook OAuth credentials.</span></div>
        <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-[var(--muted)]">No notifications yet.</div>
      </Card>
    </div>
  );
}
