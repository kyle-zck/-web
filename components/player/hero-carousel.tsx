"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { Series } from "@/constants/mock-data";
import type { AppLanguage } from "@/lib/i18n/languages";
import { getSeriesI18nText } from "@/lib/i18n/seriesText";
import { tagLabel } from "@/lib/i18n/tagKey";
import { formatEngagementCount } from "@/lib/format-count";
import { getSeriesArtworkChain } from "@/lib/series/artwork";
import { PosterImage } from "@/components/ui/poster-image";

export type HeroEngagementCounts = {
  collectionCount: number;
  likesCount: number;
  viewsCount: number;
};

interface HeroCarouselProps {
  items: Series[];
  /** 与详情页同源：收藏数 / 点赞数 / 观看数（每用户每剧一条） */
  countsBySeriesId?: Record<string, HeroEngagementCounts>;
}

function PlayGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
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

export function HeroCarousel({ items, countsBySeriesId }: HeroCarouselProps) {
  const router = useRouter();
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
    <section className="relative mb-6 pt-6 pb-8 sm:pt-8 sm:pb-10 md:pb-12">
      <div
        className="flex items-center justify-center gap-4 overflow-x-visible scrollbar-thin snap-x snap-mandatory scroll-smooth md:gap-6"
        ref={scrollRef}
      >
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          const scaleClass = isActive ? "scale-[1.3] z-20" : "scale-100 z-10";
          const { title, description } = getSeriesI18nText(item, lang);
          const categoryLabel = tagLabel(item.category, t);
          const eng = countsBySeriesId?.[item.id];
          const artworkChain = getSeriesArtworkChain(item);
          return (
            <div
              key={item.id}
              data-index={index}
              className={`relative w-[178px] shrink-0 snap-center sm:w-[212px] md:w-[254px] transition-transform duration-300 ${scaleClass}`}
            >
              <Link
                href={`/series/${item.id}`}
                prefetch={false}
                onMouseEnter={() => router.prefetch(`/series/${item.id}`)}
                className="group block"
              >
                <div className="poster-card-drama relative aspect-[3/4] w-full overflow-hidden">
                  <PosterImage
                    chain={artworkChain}
                    alt={title}
                    sizes="(max-width:640px) min(46vw, 280px), (max-width:1024px) 240px, 280px"
                    className="poster-card-drama__img"
                    priority={index === 0}
                  />
                  <div
                    className="poster-card-drama__overlay poster-card-drama__overlay--hero absolute inset-0 z-[1]"
                    aria-hidden
                  />
                  {/* 悬停：较轻压暗（图4），文案加阴影更易读 */}
                  <div className="pointer-events-none absolute inset-0 z-[2] flex flex-col justify-end bg-gradient-to-t from-black/50 via-black/15 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <div className="space-y-2 p-3">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-red-300 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
                        {categoryLabel}
                      </p>
                      <p className="line-clamp-3 text-xs font-semibold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.85)]">
                        {description ?? title}
                      </p>
                      {eng ? (
                        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] font-semibold tabular-nums text-zinc-200 [text-shadow:0_1px_3px_rgba(0,0,0,0.95)]">
                          <span className="inline-flex items-center gap-0.5" title={t("seriesDetail.views")}>
                            <PlayGlyph className="shrink-0 opacity-90" />
                            {formatEngagementCount(eng.viewsCount)}
                          </span>
                          <span className="inline-flex items-center gap-0.5" title={t("seriesDetail.favorites")}>
                            <span className="text-[11px]" aria-hidden>
                              ★
                            </span>
                            {formatEngagementCount(eng.collectionCount)}
                          </span>
                          <span className="inline-flex items-center gap-0.5" title={t("seriesDetail.likes")}>
                            <span className="text-[11px]" aria-hidden>
                              ♥
                            </span>
                            {formatEngagementCount(eng.likesCount)}
                          </span>
                        </div>
                      ) : null}
                      <span className="mt-1 inline-flex w-1/2 items-center justify-center rounded-full bg-gradient-to-r from-brand to-red-600 px-3 py-1.5 text-sm font-extrabold text-white shadow-[0_0_20px_rgba(229,9,20,0.55)]">
                        Play
                      </span>
                    </div>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-[clamp(0.875rem,0.8rem+0.35vw,1.125rem)] font-bold leading-snug tracking-tight text-zinc-50 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] sm:mt-2.5 sm:text-[clamp(1rem,0.9rem+0.4vw,1.25rem)]">
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
