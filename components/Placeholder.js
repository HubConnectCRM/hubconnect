"use client";

import { useTranslation } from "react-i18next";

export default function Placeholder({ navKey }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold">{t(`nav.${navKey}`)}</h1>
      <div className="mt-6 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--muted)]">
        {t("common.comingSoon")}
      </div>
    </div>
  );
}
