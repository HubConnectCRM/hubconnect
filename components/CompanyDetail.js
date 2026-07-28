"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button, Card, PageHeader } from "@/components/ui";
import DeleteButton from "@/components/DeleteButton";
import { deleteCompany, refreshCompanyCache } from "@/app/(app)/companies/actions";

export default function CompanyDetail({ company }) {
  const { t, i18n } = useTranslation();
  const contacts = company.contacts || [];
  const [pending, startTransition] = useTransition();
  const [cacheMsg, setCacheMsg] = useState(null);
  const location = [company.city, company.country].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4">
        <Button variant="ghost" href="/companies">
          ← {t("common.back")}
        </Button>
      </div>

      <PageHeader title={company.name} subtitle={company.sector || undefined}>
        <Button href={`/contacts/new?companyId=${company.id}`}>+ {t("contacts.new")}</Button>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={() => startTransition(async () => {
            const res = await refreshCompanyCache(company.id, i18n.language);
            setCacheMsg(res?.ok ? t("companies.cacheRefreshed") : (res?.error || t("companies.cacheRefreshFailed")));
          })}
        >
          {pending ? t("companies.refreshingCache") : t("companies.refreshCache")}
        </Button>
        <Button variant="secondary" href={`/companies/${company.id}/edit`}>
          {t("common.edit")}
        </Button>
        <DeleteButton
          action={deleteCompany}
          id={company.id}
          confirmText={t("companies.deleteConfirm")}
        />
      </PageHeader>

      {cacheMsg && <p className="mb-3 text-sm text-green-700">{cacheMsg}</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="space-y-3 p-5 md:col-span-3">
          <Row label={t("companies.location")} value={location} />
          <Row
            label={t("common.website")}
            value={
              company.website ? (
                <a
                  href={company.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--brand)] hover:underline"
                >
                  {company.website}
                </a>
              ) : null
            }
          />
          {company.overview && <CompanyCache overview={company.overview} />}
        </Card>

        <Card className="p-5 md:col-span-3">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-xs uppercase tracking-[.14em] text-[var(--brand)]">{t("companies.title")}</p><h2 className="mt-1 text-lg font-semibold">{t("companies.contacts")} ({contacts.length})</h2></div><Button variant="secondary" href={`/contacts/new?companyId=${company.id}`}>{t("contacts.new")}</Button></div>
          {contacts.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t("contacts.empty")}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {contacts.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/contacts/${c.id}`}
                    className="flex items-center justify-between py-2.5 hover:opacity-80"
                  >
                    <div>
                      <p className="text-sm font-medium">{c.full_name || "—"}</p>
                      <p className="text-sm text-[var(--muted)]">{c.job_title || ""}</p>
                    </div>
                    <span className="text-sm text-[var(--muted)]">{c.email || ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function CompanyCache({ overview }) {
  const { t } = useTranslation();
  const rows = String(overview || "")
    .split(/\n+/)
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return null;
      return { label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    })
    .filter(Boolean);
  if (!rows.length) return <p className="mt-1 whitespace-pre-wrap text-sm">{overview}</p>;
  return (
    <div className="md:col-span-3">
      <p className="mb-2 text-xs text-[var(--muted)]">{t("companies.cacheLabel")}</p>
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background)]">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-1 border-b border-[var(--border)] last:border-0 md:grid-cols-[220px_1fr]">
            <div className="bg-[var(--surface)] px-3 py-2 text-sm font-medium">{r.label}</div>
            <div className="px-3 py-2 text-sm text-[var(--muted)]">{r.value || "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}
