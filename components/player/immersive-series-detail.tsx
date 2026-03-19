"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Episode, Series } from "@/constants/mock-data";
import { usePlayerStore } from "@/lib/store/player";
import { ImmersivePlayer } from "@/components/player/immersive-player";
import { IconButton } from "@/components/ui/icon-button";
import { Badge } from "@/components/ui/badge";
import { SERIES_LIST } from "@/constants/mock-data";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { AppLanguage } from "@/lib/i18n/languages";
import { getSeriesI18nText } from "@/lib/i18n/seriesText";
import { getTagKey } from "@/lib/i18n/tagKey";
import { Modal } from "@/components/ui/modal";

const EPISODES_PER_TAB = 30;

function pickRecommended(currentId: string) {
  return SERIES_LIST.filter((s) => s.id !== currentId).slice(0, 14);
}

function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  const onShare = async () => {
    try {
      const url = window.location.href;
      const nav = navigator as Navigator & { share?: (data: { title: string; url: string }) => Promise<void> };
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
      <IconButton label={t("seriesDetail.share")} onClick={onShare}>
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
  const { setSeries, episodeIndex, setEpisodeIndex, isEpisodeUnlocked } = usePlayerStore();

  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const [plotExpanded, setPlotExpanded] = useState(false);
  const [episodeTab, setEpisodeTab] = useState(0);
  const [allEpisodesOpen, setAllEpisodesOpen] = useState(false);

  useEffect(() => {
    setSeries(series.id);
  }, [series.id, setSeries]);

  const episode = useMemo<Episode>(() => {
    return series.episodes.find((e) => e.index === episodeIndex) ?? series.episodes[0];
  }, [episodeIndex, series.episodes]);

  const recommended = useMemo(() => pickRecommended(series.id), [series.id]);
  const seriesTitle = getSeriesI18nText(series, lang).title;
  const description = getSeriesI18nText(series, lang).description ?? getSeriesI18nText(series, lang).tagline ?? "";
  const episodeLabel = lang === "zh-CN" ? t("series.episodeLabelZh", { index: episode.index }) : t("series.episodeLabel", { index: episode.index });

  const tabs = useMemo(() => {
    const total = series.episodes.length;
    const list: { label: string; start: number; end: number }[] = [];
    for (let start = 1; start <= total; start += EPISODES_PER_TAB) {
      const end = Math.min(start + EPISODES_PER_TAB - 1, total);
      list.push({ label: `${start}-${end}`, start, end });
    }
    return list;
  }, [series.episodes.length]);

  const episodesInTab = useMemo(() => {
    if (tabs.length === 0) return [];
    const tab = tabs[episodeTab] ?? tabs[0];
    return series.episodes.filter((e) => e.index >= tab.start && e.index <= tab.end);
  }, [series.episodes, tabs, episodeTab]);

  return (
    <div className="min-h-screen pb-16">
      {/* 两栏布局：左约 40% 播放器，右约 60% 信息区 */}
      <div className="mx-auto flex max-w-6xl flex-col px-4 pt-4 lg:flex-row lg:gap-8 lg:px-6">
        {/* 左侧：返回 + 9:16 播放器 */}
        <div className="mb-6 w-full lg:mb-0 lg:w-2/5 lg:min-w-[320px]">
          <div className="relative mx-auto w-full max-w-[320px]">
            {/* 半透明圆形返回按钮覆盖在左上角 */}
            <button
              type="button"
              onClick={() => (window.location.href = "/")}
              className="absolute left-2 top-2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-zinc-200 ring-1 ring-zinc-800/80 hover:bg-black"
              aria-label={t("backHome")}
            >
              ←
            </button>
            <ImmersivePlayer series={series} episode={episode} />
          </div>
        </div>

        {/* 右侧：面包屑、标题、剧情、标签、互动、选集（图5） */}
        <div className="w-full lg:w-3/5 lg:min-w-0">
          <nav className="text-xs text-zinc-500">
            <Link href="/" className="hover:text-zinc-200">
              Home
            </Link>
            <span className="mx-1">/</span>
            <span className="text-zinc-300">{seriesTitle}</span>
            <span className="mx-1">/</span>
            <span>{episodeLabel}</span>
          </nav>

          <h1 className="mt-2 text-2xl font-bold text-white md:text-3xl">
            {episodeLabel} - {seriesTitle}
          </h1>

          <section className="mt-4">
            <h2 className="text-sm font-semibold text-zinc-200">{t("seriesDetail.plotOfEpisode", { index: episode.index })}</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-400">
              {plotExpanded ? description : `${description.slice(0, 180)}${description.length > 180 ? "…" : ""}`}
            </p>
            {description.length > 180 && (
              <button
                type="button"
                onClick={() => setPlotExpanded((v) => !v)}
                className="mt-1 text-sm font-medium text-brand hover:underline"
              >
                {plotExpanded ? "↑" : t("seriesDetail.more")}
              </button>
            )}
          </section>

          <div className="mt-4 flex flex-wrap gap-2">
            {series.tags.map((tag) => (
              <Badge
                key={tag}
                variant="pill"
                className="bg-[#222222] text-white px-3 py-1 text-[11px]"
              >
                {t(`tags.${getTagKey(tag)}`)}
              </Badge>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-6 text-xs text-zinc-400">
            <div className="flex flex-col items-center gap-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 ring-1 ring-zinc-700">
                ♥
              </span>
              <span>16.3k</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 ring-1 ring-zinc-700">
                ★
              </span>
              <span>15.6k</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 ring-1 ring-zinc-700">
                ↗
              </span>
              <span>5.7k</span>
            </div>
            <div className="ml-auto">
              <ShareButton title={seriesTitle} />
            </div>
          </div>

          <section className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-100">
                {t("seriesDetail.selectEpisodes")}
              </h2>
              <button
                type="button"
                onClick={() => setAllEpisodesOpen(true)}
                className="text-xs font-medium text-brand hover:underline"
              >
                {t("seriesDetail.allEpisodes")} &gt;
              </button>
            </div>
            {tabs.length > 1 && (
              <div className="mt-2 flex gap-2 border-b border-zinc-800/80 pb-2">
                {tabs.map((tab, i) => (
                  <button
                    key={tab.label}
                    type="button"
                    onClick={() => setEpisodeTab(i)}
                    className={cn(
                      "rounded px-3 py-1.5 text-xs font-medium transition-colors",
                      episodeTab === i ? "border-b-2 border-brand text-brand" : "text-zinc-400 hover:text-white"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-1 text-[11px] text-zinc-500">
              {t("seriesDetail.episodesHint")}
            </p>
            <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-8">
              {episodesInTab.map((ep) => {
                const selected = ep.index === episode.index;
                const unlocked = isEpisodeUnlocked(series, ep);
                const isLockedCandidate = ep.index >= 4 && !unlocked;
                return (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => setEpisodeIndex(ep.index)}
                    className={cn(
                      "relative flex aspect-square items-center justify-center rounded-lg border text-xs font-semibold transition-colors",
                      selected
                        ? "border-transparent bg-gradient-to-br from-brand to-red-600 text-white"
                        : "border-zinc-700/80 bg-zinc-900/60 text-zinc-200 hover:border-zinc-600",
                      isLockedCandidate && "opacity-90"
                    )}
                  >
                    {selected ? (
                      <span className="eq-bars" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : (
                      ep.index
                    )}
                    {isLockedCandidate && (
                      <span
                        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] text-white"
                        title={t("series.locked")}
                      >
                        🔒
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {/* 底部：推荐位（图6）9:16 海报网格 */}
      <section className="mx-auto max-w-6xl px-4 pt-10 lg:px-6">
        <h2 className="text-lg font-bold text-white">{t("seriesDetail.recommendedForYou")}</h2>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7">
          {recommended.map((s) => {
            const { title } = getSeriesI18nText(s, lang);
            const categoryLabel = t(`tags.${getTagKey(s.category)}`);
            return (
              <Link
                key={s.id}
                href={`/series/${s.id}`}
                className="group"
              >
                <div className="relative poster-aspect overflow-hidden rounded-lg bg-zinc-900">
                  <img
                    src={s.cover}
                    alt={title}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs font-medium text-white">{title}</p>
                <span className="mt-0.5 inline-block rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-300">
                  {categoryLabel}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 全部剧集选择弹窗 */}
      <Modal
        open={allEpisodesOpen}
        onClose={() => setAllEpisodesOpen(false)}
        title={t("seriesDetail.allEpisodes")}
        footer={null}
      >
        <div className="max-h-[420px] overflow-y-auto scrollbar-thin episode-scroll">
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
            {series.episodes.map((ep) => {
              const selected = ep.index === episode.index;
              const unlocked = isEpisodeUnlocked(series, ep);
              const isLockedCandidate = ep.index >= 4 && !unlocked;
              return (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => {
                    setEpisodeIndex(ep.index);
                    setAllEpisodesOpen(false);
                  }}
                  className={cn(
                    "relative flex aspect-square items-center justify-center rounded-md border text-xs font-semibold transition-colors",
                    selected
                      ? "border-transparent bg-gradient-to-br from-brand to-red-600 text-white"
                      : "border-zinc-700/80 bg-zinc-900/70 text-zinc-200 hover:border-zinc-600",
                    isLockedCandidate && "opacity-90"
                  )}
                >
                  {selected ? (
                    <span className="eq-bars" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : (
                    ep.index
                  )}
                  {isLockedCandidate && (
                    <span
                      className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] text-white"
                      title={t("series.locked")}
                    >
                      🔒
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      {/* 右下角客服 / 反馈小头像浮标 */}
      <button
        type="button"
        className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-sm text-white ring-2 ring-zinc-700 shadow-lg shadow-black/70"
        aria-label="feedback"
      >
        🙂
      </button>
    </div>
  );
}
