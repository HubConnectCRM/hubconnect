"use client";

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import it from "./locales/it.json";
import tr from "./locales/tr.json";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "it", label: "Italiano" },
  { code: "tr", label: "Türkçe" },
];

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      it: { translation: it },
      tr: { translation: tr },
    },
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export default i18n;
