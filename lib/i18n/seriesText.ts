import type { AppLanguage } from "./languages";
import type { Series } from "@/constants/mock-data";

export function getSeriesI18nText(series: Series, lang: AppLanguage) {
  const localized = series.i18n?.[lang];
  return {
    title: localized?.title ?? series.title,
    tagline: localized?.tagline ?? series.tagline,
    description: localized?.description ?? series.description ?? series.tagline
  };
}

