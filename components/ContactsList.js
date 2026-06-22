"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { Icon } from "@/components/icons";

export default function ContactsList({ contacts, owners }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return contacts.filter((c) => {
      if (owner && c.ownerId !== owner) return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        (c.companyName || "").toLowerCase().includes(term) ||
        (c.email || "").toLowerCase().includes(term) ||
        (c.jobTitle || "").toLowerCase().includes(term)
      );
    });
  }, [q, owner, contacts]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("contacts.title")}>
        <Button href="/contacts/new">
          <Icon.contacts width={16} height={16} />
          {t("contacts.new")}
        </Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-64 flex-1">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("contacts.searchPlaceholder")}
          />
        </div>
        <div className="w-56">
          <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">{t("contacts.allOwners")}</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.full_name || o.email}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <p className="mb-2 text-sm text-[var(--muted)]">
        {filtered.length} {t("import.rows")}
      </p>

      {filtered.length === 0 ? (
        <EmptyState>{q || owner ? t("common.noResults") : t("contacts.empty")}</EmptyState>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("common.name")}</th>
                <th className="px-4 py-3 font-medium">{t("contacts.company")}</th>
                <th className="px-4 py-3 font-medium">{t("contacts.jobTitle")}</th>
                <th className="px-4 py-3 font-medium">{t("contacts.owner")}</th>
                <th className="px-4 py-3 font-medium">{t("common.email")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/contacts/${c.id}`)}
                  className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]"
                >
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{c.companyName || "—"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{c.jobTitle || "—"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{c.ownerName || "—"}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{c.email || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
