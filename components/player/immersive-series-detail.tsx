"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Episode, Series } from "@/constants/mock-data";
import { usePlayerStore } from "@/lib/store/player";
import { ImmersivePlayer } from "@/components/player/immersive-player";
import { IconButton } from "@/components/ui/icon-button";
import { SeriesRow } from "@/components/ui/series-row";
import { SERIES_LIST } from "@/constants/mock-data";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { AppLanguage } from "@/lib/i18n/languages";
import { getSeriesI18nText } from "@/lib/i18n/seriesText";

function pickYouMayAlsoLike(currentId: string) {
  return SERIES_LIST.filter((s) => s.id !== currentId).slice(0, 10);
}

function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  const onShare = async () => {
    try {
      const url = window.location.href;
      // 优先原生分享（移动端体验更好）
      const nav = navigator as Navigator & {
        share?: (data: { title: string; url: string }) => Promise<void>;
      };
      if (nav.share) {
        await nav.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative">
      <IconButton label="分享" onClick={onShare}>
        ⤴
      </IconButton>
      {copied ? (
        <div className="absolute right-0 top-10 rounded-full bg-zinc-950 px-3 py-1 text-[11px] text-zinc-200 ring-1 ring-zinc-800/80">
          {t("seriesDetail.copiedLink")}
        </div>
      ) : null}
    </div>
  );
}

export function ImmersiveSeriesDetail({ series }: { series: Series }) {
  const {
    setSeries,
    episodeIndex,
    setEpisodeIndex,
    isEpisodeUnlocked,
    coinBalance,
    addCoins
  } = usePlayerStore();

  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;

  useEffect(() => {
    setSeries(series.id);
  }, [series.id, setSeries]);

  const episode = useMemo<Episode>(() => {
    return (
      series.episodes.find((e) => e.index === episodeIndex) ?? series.episodes[0]
    );
  }, [episodeIndex, series.episodes]);

  const youMayAlsoLike = useMemo(
    () => pickYouMayAlsoLike(series.id),
    [series.id]
  );

  return (
    <div className="pb-24">
      <header className="sticky top-0 z-30 mx-auto max-w-md px-4 pt-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-black/60 px-3 py-2 backdrop-blur">
          <div className="flex items-center gap-2">
            <Link href="/">
              <IconButton label="返回">
                ←
              </IconButton>
            </Link>
            <div>
              <p className="line-clamp-1 text-sm font-semibold text-zinc-100">
                {getSeriesI18nText(series, lang).title}
              </p>
              <p className="text-[11px] text-zinc-400">
                {t("profile.coinBalance")}: {coinBalance} ·{" "}
                {lang === "zh-CN"
                  ? t("series.episodeLabelZh", { index: episode.index })
                  : t("series.episodeLabel", { index: episode.index })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <IconButton label="领取 Coins" onClick={() => addCoins(10)}>
              ＋
            </IconButton>
            <ShareButton title={series.title} />
          </div>
        </div>
      </header>

      <div className="px-4 pt-3">
        <ImmersivePlayer series={series} episode={episode} />
      </div>

      <section className="px-4 pt-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              {t("seriesDetail.selectEpisodes")}
            </h2>
            <p className="mt-1 text-xs text-zinc-400">
              {t("seriesDetail.episodesHint")}
            </p>
          </div>
          <p className="text-xs text-zinc-500">
            {t("home.episodesCount", { count: series.episodes.length })}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          {series.episodes.map((ep) => {
            const selected = ep.index === episode.index;
            const unlocked = isEpisodeUnlocked(series, ep);
            return (
              <button
                key={ep.id}
                type="button"
                onClick={() => setEpisodeIndex(ep.index)}
                className={cn(
                  "relative flex h-11 items-center justify-center rounded-2xl border text-xs font-semibold",
                  selected
                    ? "border-brand bg-brand/15 text-white"
                    : "border-zinc-800/80 bg-black/40 text-zinc-200",
                  !unlocked && !selected ? "opacity-90" : ""
                )}
              >
                {ep.index}
                {!unlocked ? (
                  <span className="absolute -right-1 -top-1 rounded-full bg-zinc-950 px-1.5 py-0.5 text-[10px] text-brand ring-1 ring-zinc-800/80">
                    {t("series.locked")}
                  </span>
                ) : null}
                {ep.isFree ? (
                  <span className="absolute -left-1 -top-1 rounded-full bg-zinc-950 px-1.5 py-0.5 text-[10px] text-zinc-200 ring-1 ring-zinc-800/80">
                    {t("series.free")}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-4 pt-5">
        <h2 className="text-sm font-semibold text-zinc-100">
          {t("seriesDetail.description")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-300">
          {getSeriesI18nText(series, lang).description ??
            getSeriesI18nText(series, lang).tagline}
        </p>
      </section>

      <div className="px-4 pt-5">
        <SeriesRow titleKey="seriesDetail.youMayAlsoLike" items={youMayAlsoLike} />
      </div>
    </div>
  );
}

