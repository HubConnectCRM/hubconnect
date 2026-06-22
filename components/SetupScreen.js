"use client";

import { useTranslation } from "react-i18next";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function SetupScreen() {
  const { t } = useTranslation();
  const steps = [t("setup.step1"), t("setup.step2"), t("setup.step3"), t("setup.step4")];

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-lg font-semibold text-[var(--brand)]">
            {t("common.appName")}
          </span>
          <LanguageSwitcher />
        </div>
        <h1 className="text-xl font-semibold">{t("setup.title")}</h1>
        <p className="mt-2 text-[var(--muted)]">{t("setup.body")}</p>
        <ol className="mt-6 space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[var(--brand)] text-xs font-semibold text-white">
                {i + 1}
              </span>
              <span className="pt-0.5 text-sm">{s}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 rounded-lg bg-[var(--background)] px-3 py-2 font-mono text-xs text-[var(--muted)]">
          {t("setup.envHint")}
        </p>
      </div>
    </div>
  );
}
