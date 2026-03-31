"use client";

import { useEffect } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import i18n, { preloadLanguageBundle } from "@/lib/i18n/i18n";
import type { AppLanguage } from "@/lib/i18n/languages";
import { LANGUAGE_OPTIONS } from "@/lib/i18n/languages";

function normalizeLanguage(input: string | undefined): AppLanguage {
  if (!input) return "en";
  if (input.startsWith("zh")) return "zh-CN";
  return "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

export function useAppLanguage() {
  const { i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;

  const setLanguage = (next: AppLanguage) => {
    void i18n.changeLanguage(next);
    void preloadLanguageBundle(next);
    try {
      window.localStorage.setItem("lang", next);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    let initial: AppLanguage = "en";
    try {
      const saved = window.localStorage.getItem("lang");
      if (saved === "zh-CN" || saved === "en") initial = saved;
      else initial = "en";
    } catch {
      initial = "en";
    }
    if (i18n.language !== initial) void i18n.changeLanguage(initial);
    // 中文用户首次加载时异步预取翻译包（英文已内联，无需额外加载）
    if (initial === "zh-CN") void preloadLanguageBundle("zh-CN");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { lang, setLanguage, languageOptions: LANGUAGE_OPTIONS };
}

