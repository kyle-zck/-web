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
    <section className="mb-6 lg:mb-10">
      <div className="mb-4 flex items-end justify-between px-1">
        <h2 className="text-2xl font-extrabold tracking-tight text-zinc-50 sm:text-3xl">
          {t(titleKey)}
        </h2>
        <Link
          href="/explore"
          className="text-xs font-semibold text-zinc-400 hover:text-zinc-100 lg:text-sm"
        >
          {t("home.viewAll")}
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin sm:gap-4 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:pb-0 lg:grid-cols-6 lg:gap-6">
        {items.map((s) => (
          (() => {
            const { title } = getSeriesI18nText(s, lang);
            const categoryLabel = t(`tags.${getTagKey(s.category)}`);
            return (
              <div key={s.id} className="w-36 shrink-0 sm:w-40 md:w-auto">
                <Link
                  href={`/series/${s.id}`}
                  className="group block"
                >
                  <div className="relative poster-aspect overflow-hidden rounded-2xl bg-zinc-900 transition-transform duration-200 group-hover:scale-105 group-hover:shadow-[0_0_28px_rgba(0,0,0,0.9)]">
                    <img
                      src={s.cover}
                      alt={title}
                      className="h-full w-full object-cover"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black" />

                    <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-black/80 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <div className="space-y-2 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-red-400">
                          {categoryLabel}
                        </p>
                        <p className="line-clamp-3 text-xs font-medium text-zinc-100">
                          {getSeriesI18nText(s, lang).description ??
                            getSeriesI18nText(s, lang).title}
                        </p>
                        <button
                          type="button"
                          className="mt-1 inline-flex w-1/2 items-center justify-center rounded-full bg-red-600 px-2 py-1 text-xs font-extrabold text-white shadow-[0_0_18px_rgba(229,9,20,0.7)] group-hover:bg-red-500"
                        >
                          Play
                        </button>
                      </div>
                    </div>
                  </div>
                </Link>
                <p className="mt-2 line-clamp-2 text-lg font-semibold text-zinc-50">
                  {title}
                </p>
              </div>
            );
          })()
        ))}
      </div>
    </section>
  );
}
