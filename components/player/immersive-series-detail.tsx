"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Episode, Series } from "@/constants/mock-data";
import { usePlayerStore } from "@/lib/store/player";
import { ImmersivePlayer } from "@/components/player/immersive-player";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { AppLanguage } from "@/lib/i18n/languages";
import { getSeriesI18nText } from "@/lib/i18n/seriesText";
import { getTagKey } from "@/lib/i18n/tagKey";
import { Modal } from "@/components/ui/modal";

const EPISODES_PER_TAB = 50;
const LOCK_COST = 10;

function ShareButton({ title, compact }: { title: string; compact?: boolean }) {
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

  if (compact) {
    return (
      <div className="relative flex flex-col items-center gap-1">
        <button
          type="button"
          aria-label={t("seriesDetail.share")}
          onClick={onShare}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-zinc-200"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
        <span className="text-base font-medium text-zinc-500">{t("seriesDetail.share")}</span>
      </div>
    );
  }

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
  const { setSeries, episodeIndex, setEpisodeIndex, isEpisodeUnlocked, unlockEpisode, coinBalance } = usePlayerStore();

  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const [plotExpanded, setPlotExpanded] = useState(false);
  const [episodeTab, setEpisodeTab] = useState(0);
  const [allEpisodesOpen, setAllEpisodesOpen] = useState(false);
  const [lockedEpisodeModal, setLockedEpisodeModal] = useState<Episode | null>(null);

  useEffect(() => {
    setSeries(series.id);
  }, [series.id, setSeries]);

  const episode = useMemo<Episode>(() => {
    return series.episodes.find((e) => e.index === episodeIndex) ?? series.episodes[0];
  }, [episodeIndex, series.episodes]);

  const seriesTitle = getSeriesI18nText(series, lang).title;
  const description = getSeriesI18nText(series, lang).description ?? getSeriesI18nText(series, lang).tagline ?? "";
  const episodeLabel = lang === "zh-CN" ? t("series.episodeLabelZh", { index: episode.index }) : t("series.episodeLabel", { index: episode.index });

  const tabs = useMemo(() => {
    const total = series.episodes.length;
    const list: { label: string; start: number; end: number }[] = [];
    for (let start = 1; start <= total; start += EPISODES_PER_TAB) {
      const end = Math.min(start + EPISODES_PER_TAB - 1, total);
      list.push({ label: `${start - 1} - ${end - 1}`, start, end });
    }
    return list;
  }, [series.episodes.length]);

  const episodesInTab = useMemo(() => {
    if (tabs.length === 0) return [];
    const tab = tabs[episodeTab] ?? tabs[0];
    return series.episodes.filter((e) => e.index >= tab.start && e.index <= tab.end);
  }, [series.episodes, tabs, episodeTab]);

  return (
    <>
      <div className="flex h-full min-h-0 flex-col bg-black pb-16">
        {/* 左侧：桌面端 fixed 固定，不随页面滚动；移动端正常流式布局 */}
        <aside className="relative z-10 mb-6 flex w-full shrink-0 justify-center bg-black lg:fixed lg:left-0 lg:top-20 lg:mb-0 lg:h-[calc(100dvh-5rem)] lg:w-[65vw] lg:overflow-hidden lg:border-r lg:border-zinc-900">
        <div className="relative flex h-full w-full items-center justify-center px-3 py-4 lg:px-4 lg:py-0">
          <div className="relative h-full w-auto max-w-full shrink-0 aspect-[9/16]">
              <button
                type="button"
                onClick={() => (window.location.href = "/")}
                className="absolute left-2 top-2 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/65 text-base text-zinc-100 backdrop-blur-sm ring-1 ring-white/15 hover:bg-black/80"
                aria-label={t("backHome")}
              >
                ←
              </button>
              <ImmersivePlayer series={series} episode={episode} />
            </div>
          </div>
        </aside>

        <div className="w-full min-w-0 flex-1 overflow-y-auto px-5 pb-16 pt-5 lg:ml-[65vw] lg:h-full lg:min-h-0 lg:w-[35vw] lg:px-6 lg:pt-7">
          <nav className="text-sm text-zinc-500">
            <Link href="/" className="hover:text-zinc-200">
              {t("nav.home")}
            </Link>
            <span className="mx-1.5">/</span>
            <span className="text-zinc-400">{seriesTitle}</span>
            <span className="mx-1.5">/</span>
            <span>{episodeLabel}</span>
          </nav>

          <h1 className="mt-4 text-xl font-bold leading-tight text-white lg:text-2xl">
            {episodeLabel} - {seriesTitle}
          </h1>

          <section className="mt-5">
            <h2 className="text-sm font-bold text-white">{t("seriesDetail.plotOfEpisode", { index: episode.index })}</h2>
            <p className={cn("mt-1.5 text-xs leading-5 text-zinc-500", !plotExpanded && "line-clamp-3")}>
              {description}
            </p>
            {description.length > 60 && (
              <button
                type="button"
                onClick={() => setPlotExpanded((v) => !v)}
                className="mt-0.5 text-xs font-medium text-brand hover:underline"
              >
                {plotExpanded ? "↑ " + t("seriesDetail.less") : t("seriesDetail.more")}
              </button>
            )}
          </section>

          <div className="mt-5 flex flex-wrap gap-3">
            {series.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[#222222] px-2.5 py-0.5 text-xs font-medium text-white"
              >
                {t(`tags.${getTagKey(tag)}`)}
              </span>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-around border-y border-zinc-800/80 py-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl text-zinc-400" aria-hidden>♥</span>
              <span className="text-base font-medium text-zinc-500">4.8k</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-3xl text-zinc-400" aria-hidden>★</span>
              <span className="text-base font-medium text-zinc-500">100.5k</span>
            </div>
            <ShareButton title={seriesTitle} compact />
          </div>

          <section className="mt-6">
            <h2 className="text-base font-bold text-zinc-100">
              {t("seriesDetail.selectEpisodes")}
            </h2>
            {/* 每50集为一组，超过50集显示范围 Tab，与 All Episodes 同排 */}
            {tabs.length > 1 ? (
              <div className="mt-3 flex items-center gap-4 border-b border-zinc-800/80 pb-2">
                {tabs.map((tab, i) => (
                  <button
                    key={tab.label}
                    type="button"
                    onClick={() => setEpisodeTab(i)}
                    className={cn(
                      "pb-1.5 text-base font-medium transition-colors",
                      episodeTab === i ? "border-b-2 border-brand text-brand" : "border-b-2 border-transparent text-zinc-500 hover:text-white"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setAllEpisodesOpen(true)}
                  className="text-base font-medium text-zinc-500 hover:text-white"
                >
                  {t("seriesDetail.allEpisodes")} &gt;
                </button>
              </div>
            ) : (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setAllEpisodesOpen(true)}
                  className="text-base font-medium text-brand hover:underline"
                >
                  {t("seriesDetail.allEpisodes")} &gt;
                </button>
              </div>
            )}
            <div className="episode-scroll-hide mt-3 overflow-y-auto scroll-smooth">
              <div className="grid grid-cols-6 gap-2">
                {episodesInTab.map((ep) => {
                  const selected = ep.index === episode.index;
                  const unlocked = isEpisodeUnlocked(series, ep);
                  const isLockedCandidate = ep.index >= 4 && !unlocked;
                  return (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => {
                        if (isLockedCandidate) {
                          setLockedEpisodeModal(ep);
                        } else {
                          setEpisodeIndex(ep.index);
                        }
                      }}
                      className={cn(
                      "relative flex aspect-square items-center justify-center rounded-md border text-base font-semibold transition-colors",
                      selected
                        ? "border-transparent bg-gradient-to-br from-brand to-red-600 text-white"
                        : "border-zinc-700/80 bg-zinc-900/60 text-zinc-200 hover:border-zinc-600",
                      isLockedCandidate && "opacity-90"
                    )}
                  >
                    {selected ? (
                      <>
                        <span>{ep.index}</span>
                        <span className="eq-bars absolute right-1 bottom-1" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                      </>
                    ) : (
                      ep.index
                    )}
                    {isLockedCandidate && (
                      <span
                        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[11px] text-white"
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
          </section>
        </div>
      </div>

      {/* 锁定剧集：点击弹出充值/解锁浮层 - 放在 Fragment 内与主布局同级 */}
      <Modal
        open={!!lockedEpisodeModal}
        onClose={() => setLockedEpisodeModal(null)}
        title={t("locked.title")}
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              disabled={coinBalance < LOCK_COST}
              onClick={() => {
                if (lockedEpisodeModal && unlockEpisode(series, lockedEpisodeModal, LOCK_COST)) {
                  setLockedEpisodeModal(null);
                }
              }}
              className={cn(
                "flex-1 rounded-full px-4 py-3 text-sm font-semibold text-white",
                coinBalance >= LOCK_COST ? "bg-brand hover:bg-red-600" : "cursor-not-allowed bg-zinc-700"
              )}
            >
              {t("locked.unlock", { cost: LOCK_COST })}
            </button>
            <Link
              href="/store"
              className="rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-zinc-100 ring-1 ring-zinc-800/80 hover:bg-zinc-800"
              onClick={() => setLockedEpisodeModal(null)}
            >
              {t("seriesDetail.addCoins")}
            </Link>
          </div>
        }
      >
        {lockedEpisodeModal ? (
          <p className="text-sm text-zinc-400">{t("locked.body", { index: lockedEpisodeModal.index })}</p>
        ) : null}
      </Modal>

      {/* 全部剧集选择弹窗 */}
      <Modal
        open={allEpisodesOpen}
        onClose={() => setAllEpisodesOpen(false)}
        title={t("seriesDetail.allEpisodes")}
        footer={null}
      >
        <div className="episode-scroll-hide max-h-[420px] overflow-y-auto scroll-smooth">
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
                    if (isLockedCandidate) {
                      setAllEpisodesOpen(false);
                      setLockedEpisodeModal(ep);
                    } else {
                      setEpisodeIndex(ep.index);
                      setAllEpisodesOpen(false);
                    }
                  }}
                  className={cn(
                    "relative flex aspect-square items-center justify-center rounded-md border text-base font-semibold transition-colors",
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
                      className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[11px] text-white"
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
    </>
  );
}
