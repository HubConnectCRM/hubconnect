"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, EmptyState, Input, PageHeader } from "@/components/ui";

export default function CostPickerView({ scopes }) {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const filteredScopes = scopes.filter((scope) => !needle || scope.name.toLowerCase().includes(needle));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title={t("cost.open")} subtitle={t("cost.pickerSubtitle")} />
      <Card className="mb-6 p-4">
        <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder={t("cost.pickerSearch")} />
      </Card>

      {filteredScopes.length === 0 ? (
        <EmptyState>{t("common.noResults")}</EmptyState>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filteredScopes.map((scope) => (
            <a key={scope.id} href={scope.href}>
              <Card className="p-4 transition hover:border-[var(--brand)]/40">
                <p className="font-semibold">{scope.name}</p>
                {scope.date && <p className="mt-1 text-xs text-[var(--muted)]">{new Date(scope.date).toLocaleDateString()}</p>}
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
