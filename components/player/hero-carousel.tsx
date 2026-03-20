"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { Series } from "@/constants/mock-data";
import type { AppLanguage } from "@/lib/i18n/languages";
import { getSeriesI18nText } from "@/lib/i18n/seriesText";
import { getTagKey } from "@/lib/i18n/tagKey";

interface HeroCarouselProps {
  items: Series[];
}

function ChevronLeft() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function HeroCarousel({ items }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  const goPrev = () => {
    setActiveIndex((i) => (i - 1 + items.length) % items.length);
  };

  const goNext = () => {
    setActiveIndex((i) => (i + 1) % items.length);
  };

  return (
    <section className="relative mb-6 pt-8 pb-8">
      <div
        className="flex items-center justify-center gap-4 overflow-x-visible scrollbar-thin snap-x snap-mandatory scroll-smooth md:gap-6"
        ref={scrollRef}
      >
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          const scaleClass = isActive ? "scale-[1.3] z-20" : "scale-100 z-10";
          const { title, description } = getSeriesI18nText(item, lang);
          const categoryLabel = t(`tags.${getTagKey(item.category)}`);
          return (
            <div
              key={item.id}
              data-index={index}
              className={`relative w-[160px] shrink-0 snap-center sm:w-[200px] md:w-[240px] transition-transform duration-300 ${scaleClass}`}
            >
              <Link
                href={`/series/${item.id}`}
                className="group block"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-zinc-900 shadow-lg">
                  <img
                    src={item.poster}
                    alt={title}
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/60" />
                  {/* 悬停时显示简介、标签、Play 按钮 */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-black/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="space-y-2 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-red-400">
                        {categoryLabel}
                      </p>
                      <p className="line-clamp-3 text-xs font-medium text-zinc-100">
                        {description ?? title}
                      </p>
                      <span className="mt-1 inline-flex w-1/2 items-center justify-center rounded-full bg-gradient-to-r from-brand to-red-600 px-3 py-1.5 text-sm font-extrabold text-white shadow-[0_0_20px_rgba(229,9,20,0.5)]">
                        Play
                      </span>
                    </div>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-lg font-semibold text-zinc-50">
                  {title}
                </p>
              </Link>
            </div>
          );
        })}
      </div>

      {/* 左右切换箭头（桌面端显示，美化样式） */}
      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="pointer-events-auto absolute left-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/80 text-white shadow-lg ring-1 ring-zinc-600/80 transition-all hover:bg-brand hover:ring-brand/50 md:inline-flex"
            aria-label="Previous hero"
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="pointer-events-auto absolute right-2 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/80 text-white shadow-lg ring-1 ring-zinc-600/80 transition-all hover:bg-brand hover:ring-brand/50 md:inline-flex"
            aria-label="Next hero"
          >
            <ChevronRight />
          </button>
        </>
      )}
      {/* 极简横条指示器 */}
      {items.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {items.slice(0, Math.min(items.length, 8)).map((_, i) => (
            <span
              key={i}
              className={`h-0.5 rounded-full transition-all ${
                i === activeIndex ? "w-8 bg-brand" : "w-3 bg-zinc-600"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
