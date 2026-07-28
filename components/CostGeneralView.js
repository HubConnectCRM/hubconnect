"use client";

import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";

function euro(value) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value || 0);
}

// Company-wide rollup — every event/lead file's Bilancino added together,
// plus a breakdown so a won-but-unprofitable event doesn't hide inside the
// total. Read-only: editing still happens on each scope's own Cost sheet.
export default function CostGeneralView({ scopeRows, totals }) {
  const { t } = useTranslation();
  const netProfit = totals.revenue - totals.cost;
  const marginPct = totals.revenue > 0 ? (netProfit / totals.revenue) * 100 : 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("cost.generalTitle")} subtitle={t("cost.generalSubtitle")}>
        <Button href="/api/export/cost/general" variant="secondary">{t("cost.export")}</Button>
        <Button href="/cost" variant="secondary">{t("cost.open")}</Button>
      </PageHeader>

      <Card className="mb-6 p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label={t("cost.totalRevenue")} value={euro(totals.revenue)} />
          <Stat label={t("cost.totalCost")} value={euro(totals.cost)} />
          <Stat label={t("cost.netProfit")} value={`${euro(netProfit)} (${marginPct.toFixed(1)}%)`} highlight />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)] px-5 py-3"><h2 className="text-sm font-bold text-white">{t("cost.generalBreakdown")}</h2></div>
        {scopeRows.length === 0 ? (
          <div className="p-5"><EmptyState>{t("cost.generalEmpty")}</EmptyState></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--background)] text-left text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2 font-medium">{t("cost.generalScope")}</th>
                  <th className="px-3 py-2 font-medium">{t("cost.totalRevenue")}</th>
                  <th className="px-3 py-2 font-medium">{t("cost.totalCost")}</th>
                  <th className="px-3 py-2 font-medium">{t("cost.netProfit")}</th>
                </tr>
              </thead>
              <tbody>
                {scopeRows.map((row) => (
                  <tr key={row.key} className="border-t border-[var(--border)]">
                    <td className="px-4 py-2">
                      <a href={row.kind === "event" ? `/cost?event=${row.key.split(":")[1]}` : `/cost?leadFile=${row.key.split(":")[1]}`} className="text-[var(--brand)] hover:underline">{row.name}</a>
                      <span className="ml-2"><Badge color={row.kind === "event" ? "blue" : "gray"}>{row.kind === "event" ? t("nav.events") : t("nav.leads")}</Badge></span>
                    </td>
                    <td className="px-3 py-2">{euro(row.revenue)}</td>
                    <td className="px-3 py-2">{euro(row.cost)}</td>
                    <td className={`px-3 py-2 font-medium ${row.net >= 0 ? "text-emerald-400" : "text-red-400"}`}>{euro(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${highlight ? "text-[var(--brand)]" : ""}`}>{value}</p>
    </div>
  );
}
