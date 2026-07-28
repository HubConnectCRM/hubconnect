"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { enrichExistingCompanies } from "@/app/(app)/companies/actions";
import { Icon } from "@/components/icons";

export default function CompaniesList({ companies }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pending, startTransition] = useTransition();
  const [cacheResult, setCacheResult] = useState(null);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return companies;
    return companies.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.sector || "").toLowerCase().includes(term) ||
        (c.location || "").toLowerCase().includes(term)
    );
  }, [q, companies]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("companies.title")} subtitle={t("companies.cacheListSubtitle")}>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => startTransition(async () => setCacheResult(await enrichExistingCompanies(i18n.language)))}
        >
          {pending ? t("companies.cachingMissing") : t("companies.cacheMissing")}
        </Button>
        <Button href="/companies/new">
          <Icon.companies width={16} height={16} />
          {t("companies.new")}
        </Button>
      </PageHeader>

      {cacheResult?.ok && <p className="mb-3 text-sm text-green-700">{t("companies.cachedResult", { enriched: cacheResult.enriched, scanned: cacheResult.scanned })}</p>}
      {cacheResult?.error && <p className="mb-3 text-sm text-red-700">{cacheResult.error}</p>}

      <div className="mb-4">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("companies.searchPlaceholder")}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState>{q ? t("common.noResults") : t("companies.empty")}</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("common.name")}</th>
                <th className="px-4 py-3 font-medium">{t("companies.sector")}</th>
                <th className="px-4 py-3 font-medium">{t("companies.location")}</th>
                <th className="px-4 py-3 text-right font-medium">
                  {t("companies.contactsCount")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/companies/${c.id}`)}
                  className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]"
                >
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{c.sector || "—"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{c.location || "—"}</td>
                  <td className="px-4 py-3 text-right">{c.contactCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
