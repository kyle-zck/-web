"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Series } from "@/constants/mock-data";
import { Badge } from "@/components/ui/badge";
import type { AppLanguage } from "@/lib/i18n/languages";
import { getSeriesI18nText } from "@/lib/i18n/seriesText";
import { getTagKey } from "@/lib/i18n/tagKey";

interface HeroCarouselProps {
  items: Series[];
}

export function HeroCarousel({ items }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = items[activeIndex] ?? items[0];
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;

  useEffect(() => {
    if (items.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % items.length);
    }, 6000);
    return () => window.clearInterval(id);
  }, [items.length]);

  return (
    <section className="relative mb-4">
      <div className="relative video-aspect w-full overflow-hidden rounded-3xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/80 to-black shadow-soft-glow">
        {/* Purple ambience layer (avoid Tailwind arbitrary values to prevent layout/CSS issues) */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-brand/20 via-transparent to-transparent" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-0">
          <img
            src={active.poster}
            alt={getSeriesI18nText(active, lang).title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        </div>
        <div className="relative flex h-full flex-col justify-end p-4">
          <div className="space-y-2">
            <h1 className="line-clamp-2 text-lg font-semibold text-white">
              {getSeriesI18nText(active, lang).title}
            </h1>
            <p className="line-clamp-2 text-xs text-zinc-300">
              {getSeriesI18nText(active, lang).tagline}
            </p>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-400">
              <span>{t("home.episodesCount", { count: active.episodes.length })}</span>
            </div>
            <Link
              href={`/series/${active.id}`}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-brand px-6 text-sm font-semibold text-white shadow-soft-glow"
            >
              {t("series.play")}
            </Link>
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="group relative thumb-aspect w-16 shrink-0 overflow-hidden rounded-2xl border border-zinc-800/80"
          >
            <img
              src={item.poster}
              alt={getSeriesI18nText(item, lang).title}
              className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-1 left-1 right-1">
              <p className="line-clamp-2 text-[10px] font-medium text-zinc-100">
                {getSeriesI18nText(item, lang).title}
              </p>
            </div>
            {index === activeIndex && (
              <div className="absolute inset-0 ring-2 ring-brand" />
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
