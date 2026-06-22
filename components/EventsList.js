"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";

export default function EventsList({ events }) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("events.title")}>
        <Button href="/events/new">
          <Icon.events width={16} height={16} />
          {t("events.new")}
        </Button>
      </PageHeader>

      {events.length === 0 ? (
        <EmptyState>{t("events.empty")}</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {events.map((e) => (
            <Link key={e.id} href={`/events/${e.id}`}>
              <Card className="h-full p-5 transition-colors hover:border-[var(--brand)]">
                <h2 className="text-lg font-semibold">{e.name}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {[e.location, e.startDate].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="mt-3 text-sm text-[var(--brand)]">
                  {t("events.count", { count: e.count })}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
