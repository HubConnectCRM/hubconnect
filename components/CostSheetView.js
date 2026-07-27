"use client";

import { useActionState, useMemo, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { addCostItem, deleteCostItem, toggleCostItemPaid } from "@/app/(app)/cost/actions";

const VAT_RATE = 0.22;

function euro(value) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value || 0);
}

// Mirrors the Bilancino Excel template exactly: free-text cost line items
// (hotel, venue, catering, anything) on one side, revenue on the other. The
// revenue side is never entered here — it's the event/lead file's own won
// deals (Sales' single source of truth), so a sponsor is never typed twice.
export default function CostSheetView({ scopeName, eventId, leadFileId, items, deals, canManage }) {
  const { t } = useTranslation();

  const revenueRows = useMemo(
    () =>
      deals.map((deal) => {
        const imponibile = Number(deal.offer_value || 0);
        const iva = imponibile * VAT_RATE;
        return { id: deal.id, name: deal.company?.name || deal.company_name || "—", imponibile, iva, totale: imponibile + iva };
      }),
    [deals]
  );

  const costTotals = items.reduce(
    (acc, item) => ({
      imponibile: acc.imponibile + Number(item.imponibile || 0),
      iva: acc.iva + Number(item.iva || 0),
      totale: acc.totale + Number(item.imponibile || 0) + Number(item.iva || 0),
    }),
    { imponibile: 0, iva: 0, totale: 0 }
  );
  const revenueTotals = revenueRows.reduce(
    (acc, row) => ({ imponibile: acc.imponibile + row.imponibile, iva: acc.iva + row.iva, totale: acc.totale + row.totale }),
    { imponibile: 0, iva: 0, totale: 0 }
  );
  const netProfit = revenueTotals.imponibile - costTotals.imponibile;
  const marginPct = revenueTotals.imponibile > 0 ? (netProfit / revenueTotals.imponibile) * 100 : 0;

  const exportHref = `/api/export/cost?${eventId ? `event=${eventId}` : `leadFile=${leadFileId}`}`;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={scopeName} subtitle={t("cost.subtitle")}>
        <Button href={exportHref} variant="secondary">{t("cost.export")}</Button>
      </PageHeader>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <CostTable items={items} totals={costTotals} canManage={canManage} eventId={eventId} leadFileId={leadFileId} />
        <RevenueTable rows={revenueRows} totals={revenueTotals} />
      </div>

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label={t("cost.totalRevenue")} value={euro(revenueTotals.totale)} />
          <Stat label={t("cost.totalCost")} value={euro(costTotals.totale)} />
          <Stat label={t("cost.netProfit")} value={`${euro(netProfit)} (${marginPct.toFixed(1)}%)`} highlight />
        </div>
      </Card>

      {canManage && (
        <Card className="mt-6 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">{t("cost.addItem")}</h2>
          <AddCostItemForm eventId={eventId} leadFileId={leadFileId} />
        </Card>
      )}
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

function CostTable({ items, totals, canManage, eventId, leadFileId }) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[#002060]/90 px-4 py-2.5">
        <h2 className="text-sm font-bold text-white">{t("cost.costi")}</h2>
      </div>
      {items.length === 0 ? (
        <div className="p-5"><EmptyState>{t("cost.noItems")}</EmptyState></div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-[var(--muted)]">
            <tr><th className="px-4 py-2 font-medium">{t("cost.description")}</th><th className="px-3 py-2 font-medium">{t("cost.imponibile")}</th><th className="px-3 py-2 font-medium">{t("cost.iva")}</th><th className="px-3 py-2 font-medium">{t("cost.total")}</th><th className="px-3 py-2" /></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-2">
                  <p>{item.description}</p>
                  {item.receiptUrl && <a href={item.receiptUrl} target="_blank" rel="noreferrer" className="text-xs text-[var(--brand)] hover:underline">{t("cost.receipt")}</a>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{euro(item.imponibile)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{euro(item.iva)}</td>
                <td className="px-3 py-2 whitespace-nowrap font-semibold">{euro(Number(item.imponibile) + Number(item.iva))}</td>
                <td className="px-3 py-2 text-right">
                  {canManage && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => startTransition(() => toggleCostItemPaid(item.id, !item.paid, eventId, leadFileId))}
                      >
                        <Badge color={item.paid ? "green" : "gray"}>{item.paid ? t("cost.paid") : t("cost.unpaid")}</Badge>
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => { if (confirm(t("cost.deleteConfirm"))) startTransition(() => deleteCostItem(item.id, eventId, leadFileId)); }}
                        className="text-xs text-red-500 hover:underline"
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--border)] font-semibold">
              <td className="px-4 py-2">{t("cost.totalCost")}</td>
              <td className="px-3 py-2">{euro(totals.imponibile)}</td>
              <td className="px-3 py-2">{euro(totals.iva)}</td>
              <td className="px-3 py-2">{euro(totals.totale)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}
    </Card>
  );
}

function RevenueTable({ rows, totals }) {
  const { t } = useTranslation();
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[#002060]/90 px-4 py-2.5">
        <h2 className="text-sm font-bold text-white">{t("cost.ricavi")}</h2>
      </div>
      {rows.length === 0 ? (
        <div className="p-5"><EmptyState>{t("cost.noRevenue")}</EmptyState></div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-[var(--muted)]">
            <tr><th className="px-4 py-2 font-medium">{t("cost.sponsor")}</th><th className="px-3 py-2 font-medium">{t("cost.imponibile")}</th><th className="px-3 py-2 font-medium">{t("cost.iva")}</th><th className="px-3 py-2 font-medium">{t("cost.total")}</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-2">{row.name}</td>
                <td className="px-3 py-2 whitespace-nowrap">{euro(row.imponibile)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{euro(row.iva)}</td>
                <td className="px-3 py-2 whitespace-nowrap font-semibold">{euro(row.totale)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--border)] font-semibold">
              <td className="px-4 py-2">{t("cost.totalRevenue")}</td>
              <td className="px-3 py-2">{euro(totals.imponibile)}</td>
              <td className="px-3 py-2">{euro(totals.iva)}</td>
              <td className="px-3 py-2">{euro(totals.totale)}</td>
            </tr>
          </tfoot>
        </table>
      )}
      <p className="border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">{t("cost.revenueHint")}</p>
    </Card>
  );
}

function AddCostItemForm({ eventId, leadFileId }) {
  const { t } = useTranslation();
  const [state, action, pending] = useActionState(addCostItem, {});

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="event_id" value={eventId || ""} />
      <input type="hidden" name="lead_file_id" value={leadFileId || ""} />
      <Field label={t("cost.description")} className="md:col-span-2">
        <Textarea name="description" required placeholder={t("cost.descriptionPlaceholder")} rows={2} />
      </Field>
      <Field label={t("cost.imponibile")}>
        <Input name="imponibile" type="number" step="0.01" min="0" defaultValue="0" required />
      </Field>
      <Field label={t("cost.iva")} hint={t("cost.ivaHint")}>
        <Input name="iva" type="number" step="0.01" min="0" defaultValue="0" />
      </Field>
      <Field label={t("cost.receipt")} className="md:col-span-2">
        <Input name="receipt" type="file" accept="image/*,application/pdf" />
      </Field>
      <div className="flex items-center gap-3 md:col-span-2">
        <Button type="submit" disabled={pending}>{pending ? t("common.saving") : t("common.add")}</Button>
        {state?.error && <span className="text-sm text-red-500">{state.error}</span>}
      </div>
    </form>
  );
}
