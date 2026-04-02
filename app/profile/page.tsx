"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthModal } from "@/components/ui/auth-modal";
import { usePlayerStore } from "@/lib/store/player";
import { useUserStore } from "@/lib/store/user";
import { useFavoritesStore } from "@/lib/store/favorites";
import type { Series } from "@/constants/mock-data";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { AppLanguage } from "@/lib/i18n/languages";
import { getSeriesI18nText } from "@/lib/i18n/seriesText";
import { tagLabel } from "@/lib/i18n/tagKey";
import { stubEpisodeForProgress } from "@/lib/series/slim-public";
import { getSeriesArtworkChain } from "@/lib/series/artwork";
import { PosterImage } from "@/components/ui/poster-image";
import { getOrCreateDeviceClientId } from "@/lib/client/device-client-id";

type TabId = "history" | "mylist" | "wallet";

interface RechargeRecord {
  id: string;
  uid: string;
  date: string;
  price: number;
  tier: string;
  createdAt?: string;
}

interface WatchHistoryEntry {
  seriesId: string;
  episodeIndex: number;
  seconds: number;
  lastWatchedAt?: string;
}

function formatSeconds(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function formatUsd(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(price);
}

export default function ProfilePage() {
  const router = useRouter();
  const { isLoggedIn, userId, supabaseUserId, uid, logout, fetchUid } = useUserStore();
  const {
    isSubscribed,
    subscriptionTier,
    getDaysRemaining,
    setSubscribed,
    progressSeconds,
    setEpisodeIndex,
    setSeries
  } = usePlayerStore();
  const { seriesIds: localFavoriteIds } = useFavoritesStore();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;

  const [authOpen, setAuthOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("history");
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [rechargeRecords, setRechargeRecords] = useState<RechargeRecord[]>([]);
  const [watchHistoryEntries, setWatchHistoryEntries] = useState<WatchHistoryEntry[]>([]);
  const [favoriteSeriesIds, setFavoriteSeriesIds] = useState<string[]>([]);
  const lastHistorySyncRef = useRef("");
  const lastFavoritesSyncRef = useRef("");

  useEffect(() => {
    fetch("/api/series?lite=1", { cache: "default" })
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.series)) {
          setSeriesList(json.series as Series[]);
        }
      })
      .catch(() => setSeriesList([]));
  }, []);

  useEffect(() => {
    fetchUid().catch((err) => {
      console.warn("[profile] fetchUid failed:", err);
    });
  }, [isLoggedIn, userId, fetchUid]);

  // 会员状态以服务端为准：避免“后台已删除会员，但前端仍显示 Active（persist 缓存）”
  useEffect(() => {
    const clientId = supabaseUserId ?? getOrCreateDeviceClientId();
    if (!clientId) return;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 6000);
    fetch(`/api/user/recharge?clientId=${encodeURIComponent(clientId)}`, {
      signal: ctrl.signal,
      cache: "no-store"
    })
      .then((r) => r.json())
      .then((json) => {
        const list = (json?.records ?? []) as Array<{ tier?: string; remainingDays?: number }>;
        if (!Array.isArray(list) || list.length === 0) {
          setSubscribed(false);
          return;
        }
        const active = list
          .map((x) => ({
            tier: String(x.tier ?? ""),
            remainingDays: Number.isFinite(Number(x.remainingDays)) ? Number(x.remainingDays) : 0
          }))
          .sort((a, b) => b.remainingDays - a.remainingDays)[0];
        if (!active || active.remainingDays <= 0) {
          setSubscribed(false);
          return;
        }
        setSubscribed(true, active.remainingDays, active.tier || "VIP");
      })
      .catch(() => {
        // ignore
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [supabaseUserId, setSubscribed]);

  // 同步本地数据到管理后台，并从管理后台拉取
  useEffect(() => {
    const clientId = supabaseUserId ?? getOrCreateDeviceClientId();
    if (!clientId) return;

    const entries: WatchHistoryEntry[] = Object.entries(progressSeconds)
      .filter(([, s]) => s > 0)
      .map(([key, seconds]) => {
        const [seriesId, idx] = key.split("::");
        return {
          seriesId,
          episodeIndex: Number(idx),
          seconds
        };
      });

    const historyPayload = JSON.stringify({ clientId, entries });
    const favoritesPayload = JSON.stringify({ clientId, seriesIds: localFavoriteIds });
    if (
      historyPayload === lastHistorySyncRef.current &&
      favoritesPayload === lastFavoritesSyncRef.current
    ) {
      return;
    }
    lastHistorySyncRef.current = historyPayload;
    lastFavoritesSyncRef.current = favoritesPayload;

    const ctrl = new AbortController();
    const timer = window.setTimeout(() => {
      fetch("/api/user/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: historyPayload,
        signal: ctrl.signal
      })
        .then(() => fetch(`/api/user/history?clientId=${encodeURIComponent(clientId)}`, { signal: ctrl.signal }))
        .then((r) => r.json())
        .then((json) => {
          if (json?.ok && Array.isArray(json.entries)) {
            setWatchHistoryEntries(json.entries);
          } else {
            setWatchHistoryEntries(entries);
          }
        })
        .catch(() => setWatchHistoryEntries(entries));

      fetch("/api/user/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: favoritesPayload,
        signal: ctrl.signal
      })
        .then(() => fetch(`/api/user/favorites?clientId=${encodeURIComponent(clientId)}`, { signal: ctrl.signal }))
        .then((r) => r.json())
        .then((json) => {
          if (json?.ok && Array.isArray(json.seriesIds)) {
            setFavoriteSeriesIds(json.seriesIds);
          } else {
            setFavoriteSeriesIds(localFavoriteIds);
          }
        })
        .catch(() => setFavoriteSeriesIds(localFavoriteIds));
    }, 250);

    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [supabaseUserId, progressSeconds, localFavoriteIds]);

  useEffect(() => {
    if (activeTab === "wallet") {
      const clientId = supabaseUserId ?? getOrCreateDeviceClientId();
      if (!clientId) return;
      fetch(`/api/user/recharge?clientId=${encodeURIComponent(clientId)}`)
        .then((r) => r.json())
        .then((json) => {
          if (json?.ok && Array.isArray(json.records)) {
            setRechargeRecords(json.records);
          }
        })
        .catch(() => setRechargeRecords([]));
    }
  }, [activeTab, supabaseUserId]);

  const seriesById = useMemo(
    () => new Map(seriesList.map((s) => [s.id, s] as const)),
    [seriesList]
  );

  const watchedHistory = useMemo(() => {
    // History 同步后优先展示服务端口径；无服务端数据时回落到本地 progressSeconds。
    const entries =
      (watchHistoryEntries.length > 0 ? watchHistoryEntries : null) ??
      Object.entries(progressSeconds)
        .filter(([, s]) => s > 0)
        .map(([key, seconds]) => {
          const [seriesId, idx] = key.split("::");
          return { seriesId, episodeIndex: Number(idx), seconds };
        });
    return entries
      .map((e) => {
        const series = seriesById.get(e.seriesId);
        if (!series) return null;
        const episode =
          series.episodes.find((ep) => ep.index === e.episodeIndex) ??
          stubEpisodeForProgress(e.seriesId, e.episodeIndex);
        return { series, episode, seconds: e.seconds };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.seconds ?? 0) - (a?.seconds ?? 0)) as Array<{
      series: Series;
      episode: Series["episodes"][number];
      seconds: number;
    }>;
  }, [watchHistoryEntries, progressSeconds, seriesById]);

  const watchedHistoryWithArtwork = useMemo(() => {
    return watchedHistory.map((row) => ({
      ...row,
      artworkChain: getSeriesArtworkChain(row.series)
    }));
  }, [watchedHistory]);

  const favoriteSeries = useMemo(() => {
    const ids = isLoggedIn ? favoriteSeriesIds : localFavoriteIds;
    const idSet = new Set(ids);
    return seriesList.filter((s) => idSet.has(s.id));
  }, [isLoggedIn, favoriteSeriesIds, localFavoriteIds, seriesList]);

  const favoriteSeriesWithArtwork = useMemo(() => {
    return favoriteSeries.map((s) => ({
      ...s,
      artworkChain: getSeriesArtworkChain(s)
    }));
  }, [favoriteSeries]);

  const NAV: { id: TabId; labelKey: string; icon: string }[] = [
    { id: "history", labelKey: "common.profile.history", icon: "🕐" },
    { id: "mylist", labelKey: "common.profile.myList", icon: "📁" },
    { id: "wallet", labelKey: "common.profile.wallet", icon: "💰" }
  ];

  const vipStatusText = isSubscribed
    ? (subscriptionTier ?? t("common.subscription.active", "Active"))
    : t("common.subscription.inactive");

  return (
    <main className="page-gutter-x flex min-h-screen flex-col bg-black lg:flex-row">
      {/* 左侧边栏：移动端顶部紧凑，桌面端 30% */}
      <aside className="flex shrink-0 flex-col border-b border-zinc-800/80 bg-black/60 p-4 lg:w-[30%] lg:min-w-[240px] lg:max-w-[320px] lg:border-b-0 lg:border-r lg:py-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-700/80 lg:h-12 lg:w-12" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">
              {isLoggedIn ? (userId ?? t("common.profile.user")) : t("common.profile.guest")}
            </p>
            <p className="text-xs text-zinc-400">
              {t("common.uidLabel", "UID")}: {uid ?? "—"}
            </p>
          </div>
          {isLoggedIn ? (
            <button
              type="button"
              onClick={logout}
              className="touch-target shrink-0 rounded-lg border border-zinc-600 px-2 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
            >
              {t("common.profile.logout")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="touch-target shrink-0 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
            >
              {t("common.profile.login")}
            </button>
          )}
        </div>

        {/* VIP Status + Days Remaining */}
        <div className="mt-3 rounded-xl border border-zinc-700/80 bg-zinc-900/60 p-3 lg:mt-4 lg:p-4">
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-400">
                {t("common.subscription.status")}
              </p>
              <p className="mt-0.5 text-base font-bold text-white lg:mt-1 lg:text-xl">{vipStatusText}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-400">
                {t("common.subscription.daysRemaining")}
              </p>
              <p className="mt-0.5 text-base font-bold text-white lg:mt-1 lg:text-xl">{getDaysRemaining()}</p>
            </div>
          </div>
          <Link
            href="/store"
            className="mt-3 block w-full rounded-2xl bg-red-600 py-2.5 text-center text-sm font-semibold text-white hover:bg-red-500 lg:mt-4 lg:py-3"
          >
            {t("common.profile.toStore")}
          </Link>
        </div>

        {/* 导航：移动端横向 Tab，桌面端纵向 */}
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:mt-4 lg:flex-col lg:space-y-1 lg:overflow-visible lg:pb-0">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "touch-target shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition-colors lg:w-full lg:flex lg:items-center lg:gap-2",
                activeTab === item.id
                  ? "bg-red-900/40 text-red-400"
                  : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
              )}
            >
              <span>{item.icon}</span>
              {t(item.labelKey)}
            </button>
          ))}
        </nav>
      </aside>

      {/* 右侧内容区 */}
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-5 lg:p-6">
        {activeTab === "history" && (
          <section>
            <h1 className="text-lg font-bold text-white">
              {t("common.profile.history")}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {t("common.profile.watchedHistory")}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {watchedHistoryWithArtwork.length ? (
                watchedHistoryWithArtwork.map((row) => (
                  <button
                    key={`${row.series.id}-${row.episode.id}`}
                    type="button"
                    onClick={() => {
                      setSeries(row.series.id);
                      setEpisodeIndex(row.episode.index);
                      router.push(`/series/${row.series.id}`);
                    }}
                    className="group w-full text-left"
                  >
                    <div className="relative poster-aspect overflow-hidden rounded-xl bg-zinc-900 transition-transform duration-200 group-hover:scale-[1.02] group-hover:shadow-[0_0_24px_rgba(229,9,20,0.25)]">
                      <PosterImage
                        chain={row.artworkChain}
                        alt={getSeriesI18nText(row.series, lang).title}
                        sizes="(max-width:640px) min(46vw, 200px), (max-width:1024px) min(28vw, 180px), 200px"
                        className="h-full w-full object-cover object-[center_22%]"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-3">
                        <p className="line-clamp-2 text-sm font-bold text-white">
                          {getSeriesI18nText(row.series, lang).title}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-300">
                          {lang === "zh-CN"
                            ? t("common.series.episodeLabelZh", { index: row.episode.index })
                            : t("common.series.episodeLabel", { index: row.episode.index })}{" "}
                          · {formatSeconds(row.seconds)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-zinc-700/80 bg-zinc-900/30 py-16">
                  <span className="text-4xl opacity-40">🕐</span>
                  <p className="mt-3 text-sm text-zinc-500">
                    {t("common.profile.nothingInside")}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "mylist" && (
          <section>
            <h1 className="text-lg font-bold text-white">
              {t("common.profile.myList")}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {t("common.profile.likedShows")}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {favoriteSeriesWithArtwork.length ? (
                favoriteSeriesWithArtwork.map((series) => (
                  <button
                    key={series.id}
                    type="button"
                    onClick={() => router.push(`/series/${series.id}`)}
                    className="group w-full text-left"
                  >
                    <div className="relative poster-aspect overflow-hidden rounded-xl bg-zinc-900 transition-transform duration-200 group-hover:scale-[1.02] group-hover:shadow-[0_0_24px_rgba(229,9,20,0.25)]">
                      <PosterImage
                        chain={series.artworkChain}
                        alt={getSeriesI18nText(series, lang).title}
                        sizes="(max-width:640px) min(46vw, 200px), (max-width:1024px) min(28vw, 180px), 200px"
                        className="h-full w-full object-cover object-[center_22%]"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-3">
                        <p className="line-clamp-2 text-sm font-bold text-white">
                          {getSeriesI18nText(series, lang).title}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-300">
                          {tagLabel(series.category, t)}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="col-span-full flex flex-col items-center justify-center rounded-xl border border-zinc-700/80 bg-zinc-900/30 py-16">
                  <span className="text-4xl opacity-40">📁</span>
                  <p className="mt-3 text-sm text-zinc-500">
                    {t("common.profile.nothingInside")}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "wallet" && (
          <section>
            <h1 className="text-lg font-bold text-white">
              {t("common.profile.wallet")}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {t("common.profile.transactionHistory")}
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-700/80 bg-zinc-900/50">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="border-b border-zinc-700/80">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">
                      {t("common.profile.date")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">
                      {t("common.profile.amount")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">
                      {t("common.profile.tier")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">
                      {t("common.profile.tradingHours")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rechargeRecords.length ? (
                    rechargeRecords.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-zinc-800/60 last:border-0"
                      >
                        <td className="px-4 py-3 text-sm text-white">{r.date}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-white">
                          {formatUsd(r.price)}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-300">{r.tier}</td>
                        <td className="px-4 py-3 text-xs text-zinc-500">
                          {r.createdAt
                            ? new Date(r.createdAt).toLocaleTimeString()
                            : "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="flex flex-col items-center justify-center py-16"
                      >
                        <span className="text-4xl opacity-40">💰</span>
                        <p className="mt-3 text-sm text-zinc-500">
                          {t("common.profile.nothingInside")}
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}
