"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

const ACTION_COLOR = { INSERT: "green", UPDATE: "blue", DELETE: "red" };

function recordLabel(row) {
  const d = row.new_data || row.old_data || {};
  return (
    d.name ||
    d.full_name ||
    [d.first_name, d.last_name].filter(Boolean).join(" ") ||
    (row.record_id ? row.record_id.slice(0, 8) : "—")
  );
}

export default function AuditLog({ logs, profiles }) {
  const { t } = useTranslation();
  const userMap = useMemo(() => {
    const m = new Map();
    profiles.forEach((p) => m.set(p.id, p.full_name || p.email));
    return m;
  }, [profiles]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title={t("audit.title")} />
      {logs.length === 0 ? (
        <EmptyState>{t("audit.empty")}</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("audit.when")}</th>
                <th className="px-4 py-3 font-medium">{t("audit.user")}</th>
                <th className="px-4 py-3 font-medium">{t("audit.action")}</th>
                <th className="px-4 py-3 font-medium">{t("audit.table")}</th>
                <th className="px-4 py-3 font-medium">{t("audit.record")}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => (
                <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {new Date(row.changed_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{userMap.get(row.user_id) || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge color={ACTION_COLOR[row.action] || "gray"}>
                      {t(`audit.actions.${row.action}`)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{row.table_name}</td>
                  <td className="px-4 py-3">{recordLabel(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
