"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, EmptyState, Input, PageHeader } from "@/components/ui";

export default function CostPickerView({ events, leadFiles }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filteredEvents = events.filter((event) => !needle || event.name.toLowerCase().includes(needle));
  const filteredLeadFiles = leadFiles.filter((file) => !needle || file.name.toLowerCase().includes(needle));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("cost.open")} subtitle={t("cost.pickerSubtitle")} />
      <Card className="mb-6 p-4">
        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder={t("cost.pickerSearch")} />
      </Card>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{t("nav.events")}</h2>
      {filteredEvents.length === 0 ? (
        <EmptyState>{t("common.noResults")}</EmptyState>
      ) : (
        <div className="mb-8 grid gap-2 sm:grid-cols-2">
          {filteredEvents.map((event) => (
            <a key={event.id} href={`/cost?event=${event.id}`}>
              <Card className="p-4 transition hover:border-[var(--brand)]/40">
                <p className="font-semibold">{event.name}</p>
                {event.start_date && <p className="mt-1 text-xs text-[var(--muted)]">{new Date(event.start_date).toLocaleDateString()}</p>}
              </Card>
            </a>
          ))}
        </div>
      )}

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{t("nav.leads")}</h2>
      {filteredLeadFiles.length === 0 ? (
        <EmptyState>{t("common.noResults")}</EmptyState>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filteredLeadFiles.map((file) => (
            <a key={file.id} href={`/cost?leadFile=${file.id}`}>
              <Card className="p-4 transition hover:border-[var(--brand)]/40">
                <p className="font-semibold">{file.name}</p>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
