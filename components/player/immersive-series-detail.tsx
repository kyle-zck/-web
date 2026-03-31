"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Episode, Series } from "@/constants/mock-data";
import { isEpisodeLocked, usePlayerStore } from "@/lib/store/player";
import { useFavoritesStore } from "@/lib/store/favorites";
import { useLikesStore } from "@/lib/store/likes";
import { useUserStore } from "@/lib/store/user";
import { ImmersivePlayer } from "@/components/player/immersive-player";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { AppLanguage } from "@/lib/i18n/languages";
import { getSeriesI18nText } from "@/lib/i18n/seriesText";
import { tagLabel } from "@/lib/i18n/tagKey";
import { Modal } from "@/components/ui/modal";
import { SubscriptionModal } from "@/components/player/subscription-modal";
import { formatEngagementCount } from "@/lib/format-count";
import { getOrCreateDeviceClientId } from "@/lib/client/device-client-id";
import type { EngagementCounts } from "@/lib/user-repo";

const EPISODES_PER_TAB = 50;

function PlayGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 5v14l11-7L8 5z" />
    </svg>
  );
}

function ShareButton({ title, compact }: { title: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();

  const onShare = async () => {
    try {
      const url = window.location.href;
      const nav = navigator as Navigator & {
        share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
      };
      if (nav.share) {
        await nav.share({
          title,
          text: `${title} - ${t("seriesDetail.shareDrama", "Watch this amazing short drama now!")}`,
          url
        });
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
      <div className="relative">
        <button
          type="button"
          aria-label={t("seriesDetail.share")}
          onClick={onShare}
          className="inline-flex items-center gap-2 rounded-lg py-1 text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-zinc-200"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
            aria-hidden
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          <span className="text-sm font-medium text-zinc-500">{t("seriesDetail.share")}</span>
        </button>
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

export function ImmersiveSeriesDetail({
  series,
  initialEngagement
}: {
  series: Series;
  initialEngagement?: EngagementCounts;
}) {
  const isSubscribed = usePlayerStore((s) => s.isSubscribed);
  const {
    setSeries,
    episodeIndex,
    setEpisodeIndex,
    getProgress,
    resetProgress
  } = usePlayerStore();
  const { has: isFavorited, toggle: toggleFavorite, seriesIds } = useFavoritesStore();
  const { has: isLiked, toggle: toggleLike } = useLikesStore();
  const { isLoggedIn, userId, supabaseUserId } = useUserStore();
  const [collectionCount, setCollectionCount] = useState(
    () => initialEngagement?.collectionCount ?? 0
  );
  const [likesCount, setLikesCount] = useState(() => initialEngagement?.likesCount ?? 0);
  const [viewsCount, setViewsCount] = useState(() => initialEngagement?.viewsCount ?? 0);

  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;
  const [plotExpanded, setPlotExpanded] = useState(false);
  const [episodeTab, setEpisodeTab] = useState(0);
  const [allEpisodesOpen, setAllEpisodesOpen] = useState(false);
  const [playerSessionKey, setPlayerSessionKey] = useState(0);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);

  useEffect(() => {
    setSeries(series.id);
  }, [series.id, setSeries]);

  /** 获取互动计数（收藏、点赞、观看数）- 延迟执行避免抢占视频带宽 */
  useEffect(() => {
    const clientId = userId ?? supabaseUserId ?? getOrCreateDeviceClientId();

    // 合并为一次 requestIdleCallback，并行发起 counts + views 两个请求
    const deferredWork = () => {
      // views 记录（仅在有 clientId 时）
      if (clientId) {
        fetch("/api/user/views", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, seriesId: series.id })
        })
          .then((r) => r.json())
          .then((json: { ok?: boolean; viewsCount?: number }) => {
            if (json?.ok && typeof json.viewsCount === "number") {
              setViewsCount(json.viewsCount);
            }
          })
          .catch(() => {});
      }

      // counts（仅在 initialEngagement 未命中时需要）
      if (initialEngagement == null) {
        fetch(`/api/series/${series.id}/counts`)
          .then((r) => r.json())
          .then((json) => {
            if (json?.ok) {
              setCollectionCount(json.collectionCount ?? 0);
              setLikesCount(json.likesCount ?? 0);
              setViewsCount(json.viewsCount ?? 0);
            }
          })
          .catch(() => {});
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = window.requestIdleCallback(deferredWork, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = globalThis.setTimeout(deferredWork, 2000);
    return () => globalThis.clearTimeout(t);
  }, [series.id, userId, supabaseUserId, initialEngagement]);

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

  const parseEpisodeDurationSeconds = (durationText?: string): number | null => {
    if (!durationText) return null;
    const parts = durationText.split(":").map((v) => Number(v.trim()));
    if (parts.some((n) => Number.isNaN(n) || n < 0)) return null;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  };

  const handleEpisodeSelect = (ep: Episode, closeAllEpisodes = false) => {
    const saved = getProgress(series.id, ep.index);
    const durationSec = parseEpisodeDurationSeconds(ep.duration);
    if (durationSec && saved >= Math.max(1, durationSec - 2)) {
      resetProgress(series.id, ep.index);
    }
    setEpisodeIndex(ep.index);
    // Force player to re-evaluate resume/replay even when clicking same episode.
    setPlayerSessionKey((k) => k + 1);
    if (closeAllEpisodes) setAllEpisodesOpen(false);
  };

  return (
    <>
      <div className="immersive-series-page flex h-full min-h-0 flex-col bg-black pb-16">
        {/* 左侧：桌面端 fixed 固定，不随页面滚动；移动端正常流式布局 */}
        <aside className="immersive-player-shell relative z-10 mb-6 flex w-full shrink-0 justify-center bg-black lg:fixed lg:left-0 lg:top-20 lg:mb-0 lg:h-[calc(100dvh-5rem)] lg:w-[65vw] lg:overflow-hidden lg:border-r lg:border-zinc-900">
        <div className="relative flex h-full w-full items-center justify-center px-3 py-4 lg:px-4 lg:py-0">
          <div className="relative h-full w-auto max-w-full shrink-0 aspect-[9/16]">
              {/* 返回按钮 - 移除以避免遮挡，web端用户可使用浏览器返回 */}
              <ImmersivePlayer
                series={series}
                episode={episode}
                sessionKey={playerSessionKey}
                onOpenSubscription={() => setSubscriptionModalOpen(true)}
              />
            </div>
          </div>
        </aside>

        <div className="immersive-info-panel w-full min-w-0 flex-1 overflow-y-auto px-5 pb-16 pt-5 lg:ml-[65vw] lg:h-full lg:min-h-0 lg:w-[35vw] lg:px-6 lg:pt-7">
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
            <p className="text-[11px] font-semibold uppercase tracking-wide text-red-400">
              {tagLabel(series.category, t)}
            </p>
            <h2 className="mt-1.5 text-xs font-bold text-zinc-500">
              {t("seriesDetail.plotOfEpisode", { index: episode.index })}
            </h2>
            <p
              className={cn(
                "mt-2 line-clamp-3 text-sm font-semibold leading-relaxed text-zinc-100 [text-shadow:0_1px_2px_rgba(0,0,0,0.25)]",
                plotExpanded && "line-clamp-none"
              )}
            >
              {description}
            </p>
            {description.length > 60 && (
              <button
                type="button"
                onClick={() => setPlotExpanded((v) => !v)}
                className="mt-1 text-xs font-medium text-brand hover:underline"
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
                {tagLabel(tag, t)}
              </span>
            ))}
          </div>

          <div className="mt-5 flex flex-nowrap items-center justify-between gap-1 border-y border-zinc-800/80 py-3 sm:gap-3 sm:py-4">
            {/* 与 Explore 一致：观看 → 收藏 → 点赞；左图标右数字 */}
            <div
              className="flex min-w-0 flex-1 items-center justify-center"
              title={t("seriesDetail.views")}
            >
              <div className="inline-flex items-center gap-1.5 text-zinc-400 sm:gap-2">
                <PlayGlyph className="h-[18px] w-[18px] shrink-0 text-zinc-400 sm:h-[22px] sm:w-[22px]" aria-hidden />
                <span className="text-sm font-medium tabular-nums text-zinc-500 sm:text-base">
                  {formatEngagementCount(viewsCount)}
                </span>
                <span className="sr-only">{t("seriesDetail.views")}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const wasCollected = isFavorited(series.id);
                toggleFavorite(series.id);
                setCollectionCount((c) => Math.max(0, wasCollected ? c - 1 : c + 1));
                const clientId = userId ?? supabaseUserId ?? getOrCreateDeviceClientId();
                if (!clientId) return;
                const next = wasCollected
                  ? seriesIds.filter((id) => id !== series.id)
                  : [...seriesIds, series.id];
                fetch("/api/user/favorites", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ clientId, seriesIds: next })
                }).catch(() => {});
              }}
              className="flex min-w-0 flex-1 items-center justify-center gap-1.5 transition-colors hover:text-brand sm:gap-2"
            >
              <span
                className={cn(
                  "text-xl leading-none sm:text-2xl",
                  isFavorited(series.id) ? "text-brand" : "text-zinc-400"
                )}
                aria-hidden
              >
                ★
              </span>
              <span className="text-sm font-medium tabular-nums text-zinc-500 sm:text-base">
                {formatEngagementCount(collectionCount)}
              </span>
              <span className="sr-only">{t("seriesDetail.favorites")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const wasLiked = isLiked(series.id);
                toggleLike(series.id);
                setLikesCount((c) => Math.max(0, wasLiked ? c - 1 : c + 1));
                const clientId = userId ?? supabaseUserId ?? getOrCreateDeviceClientId();
                if (!clientId) return;
                fetch("/api/user/likes", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    clientId,
                    seriesId: series.id,
                    liked: !wasLiked
                  })
                }).catch(() => {});
              }}
              className="flex min-w-0 flex-1 items-center justify-center gap-1.5 transition-colors hover:text-brand sm:gap-2"
            >
              <span
                className={cn(
                  "text-xl leading-none sm:text-2xl",
                  isLiked(series.id) ? "text-brand" : "text-zinc-400"
                )}
                aria-hidden
              >
                ♥
              </span>
              <span className="text-sm font-medium tabular-nums text-zinc-500 sm:text-base">
                {formatEngagementCount(likesCount)}
              </span>
              <span className="sr-only">{t("seriesDetail.likes")}</span>
            </button>
            <div className="flex min-w-0 flex-1 items-center justify-center">
              <ShareButton title={seriesTitle} compact />
            </div>
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
                      episodeTab === i ? "border-b-2 border-brand text-brand" : "border-b-2 border-transparent text-zinc-400 hover:text-white"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setAllEpisodesOpen(true)}
                  className="text-base font-medium text-zinc-400 hover:text-white"
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
                  const isLockedCandidate = !isSubscribed && isEpisodeLocked(series, ep);
                  return (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => {
                        handleEpisodeSelect(ep);
                        if (isLockedCandidate) {
                          setAllEpisodesOpen(false);
                        }
                      }}
                      className={cn(
                      "relative flex aspect-[5/4] items-center justify-center rounded-md border text-base font-semibold transition-colors",
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
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
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

      {/* 全部剧集选择弹窗 - 点击锁定剧集会切换集数，播放器显示图3 覆盖层 */}
      <Modal
        open={allEpisodesOpen}
        onClose={() => setAllEpisodesOpen(false)}
        title={t("seriesDetail.allEpisodes")}
        footer={null}
      >
        <div className="episode-scroll-hide max-h-[420px] overflow-y-auto scroll-smooth">
          <div className="grid grid-cols-6 gap-2">
            {series.episodes.map((ep) => {
              const selected = ep.index === episode.index;
              const isLockedCandidate = !isSubscribed && isEpisodeLocked(series, ep);
              return (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => {
                    handleEpisodeSelect(ep, true);
                  }}
                  className={cn(
                    "relative flex aspect-[5/4] items-center justify-center rounded-md border text-base font-semibold transition-colors",
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
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
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
        className="player-feedback-fab fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-900 text-sm text-white ring-2 ring-zinc-700 shadow-lg shadow-black/70"
        aria-label="feedback"
      >
        🙂
      </button>

      {/* 订阅弹窗 - 由 ImmersiveSeriesDetail 统一挂载 */}
      <SubscriptionModal
        open={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
      />
    </>
  );
}
