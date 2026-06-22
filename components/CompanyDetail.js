"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Button, Card, PageHeader } from "@/components/ui";
import DeleteButton from "@/components/DeleteButton";
import { deleteCompany } from "@/app/(app)/companies/actions";

export default function CompanyDetail({ company }) {
  const { t } = useTranslation();
  const contacts = company.contacts || [];
  const location = [company.city, company.country].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4">
        <Button variant="ghost" href="/companies">
          ← {t("common.back")}
        </Button>
      </div>

      <PageHeader title={company.name} subtitle={company.sector || undefined}>
        <Button variant="secondary" href={`/companies/${company.id}/edit`}>
          {t("common.edit")}
        </Button>
        <DeleteButton
          action={deleteCompany}
          id={company.id}
          confirmText={t("companies.deleteConfirm")}
        />
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="space-y-3 p-5 md:col-span-1">
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
          {company.overview && (
            <div>
              <p className="text-xs text-[var(--muted)]">{t("companies.overview")}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{company.overview}</p>
            </div>
          )}
        </Card>

        <Card className="p-5 md:col-span-2">
          <h2 className="mb-3 text-lg font-semibold">{t("companies.contacts")}</h2>
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

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}
