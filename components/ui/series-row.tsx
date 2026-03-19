"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { Series } from "@/constants/mock-data";
import type { AppLanguage } from "@/lib/i18n/languages";
import { getSeriesI18nText } from "@/lib/i18n/seriesText";
import { getTagKey } from "@/lib/i18n/tagKey";

interface SeriesRowProps {
  titleKey: string;
  items: Series[];
}

export function SeriesRow({ titleKey, items }: SeriesRowProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;

  return (
    <section className="mb-6 lg:mb-8">
      <div className="mb-2 flex items-end justify-between px-1">
        <h2 className="text-sm font-semibold text-zinc-100">{t(titleKey)}</h2>
        <Link
          href="/explore"
          className="text-xs font-medium text-zinc-400 hover:text-zinc-200"
        >
          {t("home.viewAll")}
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin md:grid md:grid-cols-5 lg:grid-cols-6 md:gap-4 lg:gap-5 md:overflow-visible md:pb-0">
        {items.map((s) => (
          (() => {
            const { title } = getSeriesI18nText(s, lang);
            const categoryLabel = t(`tags.${getTagKey(s.category)}`);
            return (
          <Link
            key={s.id}
            href={`/series/${s.id}`}
            className="group relative w-40 shrink-0 md:w-auto"
          >
            <div className="relative poster-aspect overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/50">
              <img
                src={s.cover}
                alt={title}
                className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute left-2 top-2">
                <span className="rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-zinc-200 ring-1 ring-zinc-800/80">
                  {categoryLabel}
                </span>
              </div>
              <div className="absolute bottom-2 right-2">
                <span className="inline-flex items-center justify-center rounded-full bg-brand px-3 py-1 text-[11px] font-semibold text-white shadow-soft-glow">
                  {t("series.play")}
                </span>
              </div>
            </div>
            <div className="mt-2">
              <p className="line-clamp-1 text-xs font-semibold text-zinc-100">
                {title}
              </p>
              <p className="line-clamp-1 text-[11px] text-zinc-400">
                {categoryLabel}
              </p>
            </div>
          </Link>
            );
          })()
        ))}
      </div>
    </section>
  );
}
