import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import type { AppLanguage } from "./languages";
import { resources } from "./resources";

const defaultLng: AppLanguage = "en";

if (!i18next.isInitialized) {
  void i18next.use(initReactI18next).init({
    resources,
    lng: defaultLng,
    fallbackLng: defaultLng,
    supportedLngs: ["en", "zh-CN"],
    ns: ["common"],
    defaultNS: "common",
    interpolation: { escapeValue: false }
  });
}

export default i18next;

