"use client";

import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "./config";

const STORAGE_KEY = "hc_lang";

export function setLanguage(code) {
  i18n.changeLanguage(code);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, code);
    document.documentElement.lang = code;
  }
}

export default function I18nProvider({ children, initialLang }) {
  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const lang = initialLang || stored || "en";
    if (i18n.language !== lang) i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
  }, [initialLang]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
