"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Series } from "@/constants/mock-data";
import type { AppLanguage } from "@/lib/i18n/languages";
import { getSeriesI18nText } from "@/lib/i18n/seriesText";

interface HeroCarouselProps {
  items: Series[];
}

export function HeroCarousel({ items }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const active = items[activeIndex] ?? items[0];
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;

  useEffect(() => {
    if (items.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % items.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [items.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || items.length === 0) return;
    const card = el.querySelector(`[data-index="${activeIndex}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeIndex, items.length]);

  if (items.length === 0) return null;

  return (
    <section className="relative mb-6">
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin snap-x snap-mandatory scroll-smooth md:justify-center md:gap-6" ref={scrollRef}>
        {items.map((item, index) => {
          const { title, tagline } = getSeriesI18nText(item, lang);
          const isActive = index === activeIndex;
          return (
            <div
              key={item.id}
              data-index={index}
              className="relative w-[180px] shrink-0 snap-center md:w-[220px]"
            >
              <Link
                href={`/series/${item.id}`}
                onClick={() => setActiveIndex(index)}
                className="block"
              >
                <div className={`relative aspect-[9/16] w-full overflow-hidden rounded-xl bg-zinc-900 shadow-lg transition-all duration-300 ${isActive ? "ring-2 ring-brand" : ""}`}
                >
                  <img
                    src={item.poster}
                    alt={title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h2 className="line-clamp-2 text-sm font-bold text-white">{title}</h2>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-300">{tagline}</p>
                    <p className="mt-1 text-[10px] text-zinc-400">{t("home.episodesCount", { count: item.episodes.length })}</p>
                    <span className="mt-2 inline-flex items-center justify-center rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-white">
                      {t("series.play")}
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
      {items.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {items.slice(0, Math.min(items.length, 8)).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === activeIndex ? "w-5 bg-brand" : "w-1.5 bg-zinc-600"}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
