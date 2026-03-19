"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { Episode, Series } from "@/constants/mock-data";
import { usePlayerStore } from "@/lib/store/player";
import type { AppLanguage } from "@/lib/i18n/languages";
import { getSeriesI18nText } from "@/lib/i18n/seriesText";
import { getTagKey } from "@/lib/i18n/tagKey";

function formatSeconds(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function ContinueWatching() {
  const { progressSeconds, setEpisodeIndex, setSeries } = usePlayerStore();
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;

  useEffect(() => {
    fetch("/api/series")
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.series)) {
          setSeriesList(json.series as Series[]);
        }
      })
      .catch(() => setSeriesList([]));
  }, []);

  const watched = useMemo(() => {
    const rows: Array<{ series: Series; episode: Episode; seconds: number }> =
      [];

    for (const [key, seconds] of Object.entries(progressSeconds)) {
      const [seriesId, idx] = key.split("::");
      const episodeIndex = Number(idx);
      if (!seconds || seconds <= 0) continue;
      const series = seriesList.find((s) => s.id === seriesId);
      const episode = series?.episodes.find((e) => e.index === episodeIndex);
      if (!series || !episode) continue;
      rows.push({ series, episode, seconds });
    }

    rows.sort((a, b) => b.seconds - a.seconds);
    return rows.slice(0, 6);
  }, [progressSeconds, seriesList]);

  if (!watched.length) return null;

  return (
    <section className="mt-4">
      <div className="flex items-end justify-between">
        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-50">
          {t("home.continueWatching")}
        </h2>
        <p className="text-[11px] text-zinc-500">
          {t("home.itemsCount", { count: watched.length })}
        </p>
      </div>

      <div className="mt-3 flex gap-3 overflow-x-auto pb-2 scrollbar-thin md:grid md:grid-cols-6 md:overflow-visible md:gap-4 md:pb-0">
        {watched.map((row) => (
          <div
            key={`${row.series.id}-${row.episode.id}`}
            className="w-40 shrink-0 md:w-auto"
          >
            <Link
              href={`/series/${row.series.id}`}
              onClick={(e) => {
                // Keep client state in sync for the player component
                e.preventDefault();
                setSeries(row.series.id);
                setEpisodeIndex(row.episode.index);
                window.location.href = `/series/${row.series.id}`;
              }}
              className="group block"
            >
              <div className="relative poster-aspect overflow-hidden rounded-2xl bg-zinc-900 transition-transform duration-200 group-hover:scale-105 group-hover:shadow-[0_0_28px_rgba(0,0,0,0.9)]">
                <img
                  src={row.series.cover}
                  alt={getSeriesI18nText(row.series, lang).title}
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black" />

                <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-black/80 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <div className="space-y-2 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-red-400">
                      {t(`tags.${getTagKey(row.series.category)}`)}
                    </p>
                    <p className="line-clamp-3 text-xs font-medium text-zinc-100">
                      {getSeriesI18nText(row.series, lang).description ??
                        getSeriesI18nText(row.series, lang).title}
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
            <p className="mt-2 line-clamp-2 text-xl font-semibold text-zinc-50">
              {getSeriesI18nText(row.series, lang).title}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

