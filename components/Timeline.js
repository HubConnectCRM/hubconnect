"use client";

import { useTransition } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui";
import { deleteInteraction } from "@/app/(app)/contacts/actions";

export default function Timeline({ interactions, contactId }) {
  const { t } = useTranslation();
  const [pending, startTransition] = useTransition();

  if (!interactions || interactions.length === 0) {
    return <p className="text-sm text-[var(--muted)]">{t("interactions.empty")}</p>;
  }

  return (
    <ul className="space-y-4">
      {interactions.map((it) => (
        <li key={it.id} className="relative border-l-2 border-[var(--border)] pl-4">
          <div className="flex items-center gap-2">
            <Badge color="brand">{t(`interactions.types.${it.type}`)}</Badge>
            <span className="text-xs text-[var(--muted)]">{it.occurred_on}</span>
            {it.user?.full_name && (
              <span className="text-xs text-[var(--muted)]">
                · {it.user.full_name}
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                startTransition(() => deleteInteraction(it.id, contactId))
              }
              disabled={pending}
              className="ml-auto text-xs text-[var(--muted)] hover:text-red-600"
            >
              {t("common.delete")}
            </button>
          </div>
          {it.topic && <p className="mt-1 text-sm font-medium">{it.topic}</p>}
          {it.action_text && (
            <p className="mt-0.5 whitespace-pre-wrap text-sm">{it.action_text}</p>
          )}
          {it.next_step && (
            <p className="mt-1 text-sm text-[var(--muted)]">
              → {it.next_step}
              {it.next_step_due ? ` (${it.next_step_due})` : ""}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
