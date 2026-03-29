"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Series } from "@/constants/mock-data";
import type { AppLanguage } from "@/lib/i18n/languages";
import { getSeriesI18nText } from "@/lib/i18n/seriesText";
import { tagLabel } from "@/lib/i18n/tagKey";
import { getSeriesArtworkChain } from "@/lib/series/artwork";
import { PosterImage } from "@/components/ui/poster-image";

interface SeriesRowProps {
  titleKey: string;
  items: Series[];
}

/** 与 globals.css `.home-poster-cell` 一致：小屏最小 7.5rem(120px)，lg+ 约 1/7 栅格 */
const HOME_RAIL_POSTER_SIZES =
  "(max-width:1023px) 120px, min(18vw, 200px)";

export function SeriesRow({ titleKey, items }: SeriesRowProps) {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const railRef = useRef<HTMLDivElement>(null);

  const scrollByStep = (direction: "left" | "right") => {
    const el = railRef.current;
    if (!el) return;
    const firstCell = el.querySelector<HTMLElement>(".home-poster-cell");
    const step = firstCell?.offsetWidth ?? 140;
    const gap = 12;
    const delta = step + gap;
    el.scrollBy({
      left: direction === "left" ? -delta * 2 : delta * 2,
      behavior: "smooth",
    });
  };

  return (
    <section className="home-row-cv mb-6 lg:mb-10">
      <div className="mb-4 flex items-end justify-between px-1">
        <h2 className="section-title-fluid font-extrabold tracking-tight text-zinc-50">
          {t(titleKey)}
        </h2>
        <Link
          href="/explore"
          className="text-xs font-semibold text-zinc-400 hover:text-zinc-100 lg:text-sm"
        >
          {t("home.viewAll")}
        </Link>
      </div>
      <div className="relative px-1">
        <div className="pointer-events-none absolute inset-y-0 left-2 z-20 hidden items-center lg:flex">
          <button
            type="button"
            onClick={() => scrollByStep("left")}
            className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/75 text-white shadow-lg ring-1 ring-zinc-600/80 transition-all hover:bg-brand hover:ring-brand/50"
            aria-label="Scroll posters left"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>
        <div className="pointer-events-none absolute inset-y-0 right-2 z-20 hidden items-center lg:flex">
          <button
            type="button"
            onClick={() => scrollByStep("right")}
            className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/75 text-white shadow-lg ring-1 ring-zinc-600/80 transition-all hover:bg-brand hover:ring-brand/50"
            aria-label="Scroll posters right"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        <div
          ref={railRef}
          className={cn(
            "home-poster-rail scrollbar-thin [-webkit-overflow-scrolling:touch]",
            items.length <= 7 && "home-poster-rail--fit",
            "px-10"
          )}
        >
          {items.map((s) => {
            const { title } = getSeriesI18nText(s, lang);
            const categoryLabel = tagLabel(s.category, t);
            const artworkChain = getSeriesArtworkChain(s);
            return (
              <div key={s.id} className="home-poster-cell min-w-0">
                <Link
                  href={`/series/${s.id}`}
                  prefetch={false}
                  onMouseEnter={() => router.prefetch(`/series/${s.id}`)}
                  className="group block"
                >
                  <div className="poster-card-drama relative poster-aspect transition-transform duration-250 group-hover:z-20 group-hover:scale-[1.1] group-hover:shadow-[0_0_44px_rgba(229,9,20,0.35)]">
                    <PosterImage
                      chain={artworkChain}
                      alt={title}
                      sizes={HOME_RAIL_POSTER_SIZES}
                      className="poster-card-drama__img"
                    />
                    <div
                      className="poster-card-drama__overlay absolute inset-0 z-[1]"
                      aria-hidden
                    />

                    <div className="pointer-events-none absolute inset-0 z-[2] flex flex-col justify-end bg-gradient-to-t from-black/55 via-black/18 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <div className="space-y-2 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-red-300 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
                          {categoryLabel}
                        </p>
                        <p className="line-clamp-3 text-xs font-semibold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.85)]">
                          {getSeriesI18nText(s, lang).description ??
                            getSeriesI18nText(s, lang).title}
                        </p>
                        <span className="mt-1 inline-flex w-1/2 items-center justify-center rounded-full bg-red-600 px-2 py-1 text-xs font-extrabold text-white shadow-[0_0_18px_rgba(229,9,20,0.7)] group-hover:bg-red-500">
                          Play
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
                <p className="mt-2 line-clamp-2 text-sm font-bold tracking-tight text-zinc-50 drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] sm:text-base">
                  {title}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
