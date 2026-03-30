"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import type { Episode, Series } from "@/constants/mock-data";
import { usePlayerStore } from "@/lib/store/player";
import type { AppLanguage } from "@/lib/i18n/languages";
import { getSeriesI18nText } from "@/lib/i18n/seriesText";
import { tagLabel } from "@/lib/i18n/tagKey";
import { stubEpisodeForProgress } from "@/lib/series/slim-public";
import { getSeriesArtworkChain } from "@/lib/series/artwork";
import { PosterImage } from "@/components/ui/poster-image";
import { cn } from "@/lib/utils";

export function ContinueWatching() {
  const router = useRouter();
  const { progressSeconds, setEpisodeIndex, setSeries } = usePlayerStore();
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;

  useEffect(() => {
    fetch("/api/series?lite=1")
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.series)) {
          setSeriesList(json.series as Series[]);
        }
      })
      .catch(() => setSeriesList([]));
  }, []);

  const seriesById = useMemo(
    () => new Map(seriesList.map((s) => [s.id, s] as const)),
    [seriesList]
  );

  const watched = useMemo(() => {
    const rows: Array<{ series: Series; episode: Episode; seconds: number }> =
      [];

    for (const [key, seconds] of Object.entries(progressSeconds)) {
      const [seriesId, idx] = key.split("::");
      const episodeIndex = Number(idx);
      if (!seconds || seconds <= 0) continue;
      const series = seriesById.get(seriesId);
      if (!series) continue;
      const episode =
        series.episodes.find((e) => e.index === episodeIndex) ??
        stubEpisodeForProgress(seriesId, episodeIndex);
      rows.push({ series, episode, seconds });
    }

    rows.sort((a, b) => b.seconds - a.seconds);
    return rows.slice(0, 6);
  }, [progressSeconds, seriesById]);

  if (!watched.length) return null;

  return (
    <section className="mt-4">
      <div className="flex items-end justify-between px-1">
        <h2 className="section-title-fluid font-extrabold tracking-tight text-zinc-50">
          {t("home.continueWatching")}
        </h2>
        <p className="text-[11px] text-zinc-500">
          {t("home.itemsCount", { count: watched.length })}
        </p>
      </div>

      <div className="mt-3 px-1">
        <div
          className={cn(
            "home-poster-rail scrollbar-thin [-webkit-overflow-scrolling:touch]",
            watched.length <= 7 && "home-poster-rail--fit"
          )}
          style={
            watched.length <= 7
              ? ({ "--hp-cols": Math.min(7, watched.length) } as React.CSSProperties)
              : undefined
          }
        >
        {watched.map((row) => (
          (() => {
            const artworkChain = getSeriesArtworkChain(row.series);
            return (
          <div
            key={`${row.series.id}-${row.episode.id}`}
            className="home-poster-cell min-w-0"
          >
            <Link
              href={`/series/${row.series.id}`}
              prefetch={false}
              onMouseEnter={() => router.prefetch(`/series/${row.series.id}`)}
              onClick={() => {
                // Keep client state in sync for the player component
                setSeries(row.series.id);
                setEpisodeIndex(row.episode.index);
              }}
              className="group block"
            >
              <div className="poster-card-drama relative poster-aspect transition-transform duration-200 group-hover:scale-[1.02] group-hover:shadow-[0_0_36px_rgba(229,9,20,0.2)]">
                <PosterImage
                  chain={artworkChain}
                  alt={getSeriesI18nText(row.series, lang).title}
                  sizes="(max-width:1023px) 120px, min(18vw, 200px)"
                  className="poster-card-drama__img"
                />
                <div
                  className="poster-card-drama__overlay absolute inset-0 z-[1]"
                  aria-hidden
                />

                <div className="pointer-events-none absolute inset-0 z-[2] flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/45 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <div className="space-y-2 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-red-400">
                      {tagLabel(row.series.category, t)}
                    </p>
                    <p className="line-clamp-3 text-xs font-medium text-zinc-100">
                      {getSeriesI18nText(row.series, lang).description ??
                        getSeriesI18nText(row.series, lang).title}
                    </p>
                    <span className="mt-1 inline-flex w-1/2 items-center justify-center rounded-full bg-red-600 px-2 py-1 text-xs font-extrabold text-white shadow-[0_0_18px_rgba(229,9,20,0.7)] group-hover:bg-red-500">
                      Play
                    </span>
                  </div>
                </div>
              </div>
            </Link>
            <p className="mt-2 line-clamp-2 text-sm font-bold tracking-tight text-zinc-50 drop-shadow-[0_2px_10px_rgba(0,0,0,0.85)] sm:text-base">
              {getSeriesI18nText(row.series, lang).title}
            </p>
          </div>
            );
          })()
        ))}
        </div>
      </div>
    </section>
  );
}

