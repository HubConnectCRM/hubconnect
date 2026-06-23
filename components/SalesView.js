"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Badge, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import SalesAddContact from "@/components/SalesAddContact";

const RSVP_COLOR = { yes: "green", no: "red", maybe: "amber" };

export default function SalesView({ rows, owners, events, contacts }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("");
  const [event, setEvent] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (owner && r.ownerId !== owner) return false;
      if (event && r.eventId !== event) return false;
      if (!term) return true;
      return (
        r.contactName.toLowerCase().includes(term) ||
        r.company.toLowerCase().includes(term) ||
        r.eventName.toLowerCase().includes(term) ||
        (r.lastNote || "").toLowerCase().includes(term)
      );
    });
  }, [rows, q, owner, event]);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={t("sales.title")} subtitle={t("sales.subtitle")} />

      <SalesAddContact contacts={contacts} events={events} />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-56 flex-1">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("common.search")} />
        </div>
        <div className="w-52">
          <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">{t("contacts.allOwners")}</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.full_name || o.email}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-52">
          <Select value={event} onChange={(e) => setEvent(e.target.value)}>
            <option value="">{t("sales.allEvents")}</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <p className="mb-2 text-sm text-[var(--muted)]">
        {filtered.length} {t("import.rows")}
      </p>

      {filtered.length === 0 ? (
        <EmptyState>{q || owner || event ? t("common.noResults") : t("sales.empty")}</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--border)] text-left text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("common.name")}</th>
                <th className="px-4 py-3 font-medium">{t("contacts.company")}</th>
                <th className="px-4 py-3 font-medium">{t("sales.event")}</th>
                <th className="px-4 py-3 font-medium">{t("contacts.owner")}</th>
                <th className="px-4 py-3 font-medium">{t("sales.attendance")}</th>
                <th className="px-4 py-3 font-medium">{t("sales.lastNote")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => router.push(`/events/${r.eventId}`)}
                  className="cursor-pointer border-b border-[var(--border)] last:border-0 hover:bg-[var(--background)]"
                >
                  <td className="px-4 py-3 font-medium">{r.contactName}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{r.company || "—"}</td>
                  <td className="px-4 py-3">{r.eventName}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{r.ownerName || "—"}</td>
                  <td className="px-4 py-3">
                    {r.rsvp ? (
                      <Badge color={RSVP_COLOR[r.rsvp]}>{t(`rsvp.${r.rsvp}`)}</Badge>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">{t("sales.notSet")}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {r.lastNote ? (
                      <span title={r.lastNote}>
                        {r.lastNote.length > 40 ? r.lastNote.slice(0, 40) + "…" : r.lastNote}
                        {r.lastAt && (
                          <span className="block text-xs">
                            {new Date(r.lastAt).toLocaleDateString()}
                          </span>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
