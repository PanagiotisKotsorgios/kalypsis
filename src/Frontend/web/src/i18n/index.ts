import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

import el from "./locales/el.json";
import en from "./locales/en.json";

export const i18n = i18next.createInstance();

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      el: { translation: el },
      en: { translation: en }
    },
    fallbackLng: "el",
    supportedLngs: ["el", "en"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "kalypsis_lang",
      caches: ["localStorage"]
    }
  });
