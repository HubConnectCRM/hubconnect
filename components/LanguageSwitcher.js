"use client";

import { useTranslation } from "react-i18next";
import { LANGUAGES } from "@/i18n/config";
import { setLanguage } from "@/i18n/I18nProvider";

export default function LanguageSwitcher({ onChange }) {
  const { i18n } = useTranslation();

  function handle(code) {
    setLanguage(code);
    if (onChange) onChange(code);
  }

  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5 text-sm">
      {LANGUAGES.map((l) => {
        const active = i18n.language === l.code;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => handle(l.code)}
            className={
              "rounded-md px-2.5 py-1 transition-colors " +
              (active
                ? "bg-[var(--brand)] text-white"
                : "text-[var(--muted)] hover:text-[var(--foreground)]")
            }
          >
            {l.code.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
