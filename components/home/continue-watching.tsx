"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { Episode, Series } from "@/constants/mock-data";
import { usePlayerStore } from "@/lib/store/player";
import type { AppLanguage } from "@/lib/i18n/languages";
import { getSeriesI18nText } from "@/lib/i18n/seriesText";

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
        <h2 className="text-sm font-semibold text-zinc-100">
          {t("home.continueWatching")}
        </h2>
        <p className="text-[11px] text-zinc-500">
          {t("home.itemsCount", { count: watched.length })}
        </p>
      </div>

      <div className="mt-3 flex gap-3 overflow-x-auto pb-2 scrollbar-thin md:grid md:grid-cols-6 md:overflow-visible md:gap-4 md:pb-0">
        {watched.map((row) => (
          <Link
            key={`${row.series.id}-${row.episode.id}`}
            href={`/series/${row.series.id}`}
            onClick={(e) => {
              // Keep client state in sync for the player component
              e.preventDefault();
              setSeries(row.series.id);
              setEpisodeIndex(row.episode.index);
              window.location.href = `/series/${row.series.id}`;
            }}
            className="group relative"
          >
            <div className="relative poster-aspect overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/50">
              <img
                src={row.series.cover}
                alt={getSeriesI18nText(row.series, lang).title}
                className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-zinc-200 ring-1 ring-zinc-800/80">
                {row.episode.index <= 3 ? t("series.free") : t("series.locked")}
              </div>
              <div className="absolute bottom-2 left-2 right-2">
                <p className="line-clamp-1 text-xs font-semibold text-white">
                  {lang === "zh-CN"
                    ? t("series.episodeLabelZh", { index: row.episode.index })
                    : t("series.episodeLabel", { index: row.episode.index })}
                </p>
                <p className="mt-1 text-[11px] text-zinc-200">
                  {formatSeconds(row.seconds)} {t("home.watched")}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

