"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  const { isLoggedIn, userId, uid, logout, fetchUid } = useUserStore();
  const {
    isSubscribed,
    subscriptionTier,
    getDaysRemaining,
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

  useEffect(() => {
    if (isLoggedIn && userId) {
      fetchUid().then(() => {});
    }
  }, [isLoggedIn, userId, fetchUid]);

  // 同步本地数据到管理后台，并从管理后台拉取
  useEffect(() => {
    if (!isLoggedIn || !userId) return;

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

    fetch("/api/user/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: userId, entries })
    })
      .then(() => fetch(`/api/user/history?clientId=${encodeURIComponent(userId)}`))
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
      body: JSON.stringify({ clientId: userId, seriesIds: localFavoriteIds })
    })
      .then(() => fetch(`/api/user/favorites?clientId=${encodeURIComponent(userId)}`))
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.seriesIds)) {
          setFavoriteSeriesIds(json.seriesIds);
        } else {
          setFavoriteSeriesIds(localFavoriteIds);
        }
      })
      .catch(() => setFavoriteSeriesIds(localFavoriteIds));
  }, [isLoggedIn, userId, progressSeconds, localFavoriteIds]);

  useEffect(() => {
    if (activeTab === "wallet" && userId) {
      fetch(`/api/user/recharge?clientId=${encodeURIComponent(userId)}`)
        .then((r) => r.json())
        .then((json) => {
          if (json?.ok && Array.isArray(json.records)) {
            setRechargeRecords(json.records);
          }
        })
        .catch(() => setRechargeRecords([]));
    }
  }, [activeTab, userId]);

  const watchedHistory = useMemo(() => {
    const entries = isLoggedIn ? watchHistoryEntries : (
      Object.entries(progressSeconds)
        .filter(([, s]) => s > 0)
        .map(([key, seconds]) => {
          const [seriesId, idx] = key.split("::");
          return { seriesId, episodeIndex: Number(idx), seconds };
        })
    );
    return entries
      .map((e) => {
        const series = seriesList.find((s) => s.id === e.seriesId);
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
  }, [isLoggedIn, watchHistoryEntries, progressSeconds, seriesList]);

  const favoriteSeries = useMemo(() => {
    const ids = isLoggedIn ? favoriteSeriesIds : localFavoriteIds;
    return seriesList.filter((s) => ids.includes(s.id));
  }, [isLoggedIn, favoriteSeriesIds, localFavoriteIds, seriesList]);

  const NAV: { id: TabId; labelKey: string; icon: string }[] = [
    { id: "history", labelKey: "profile.history", icon: "🕐" },
    { id: "mylist", labelKey: "profile.myList", icon: "📁" },
    { id: "wallet", labelKey: "profile.wallet", icon: "💰" }
  ];

  const vipStatusText = isSubscribed
    ? (subscriptionTier ?? t("subscription.active", "Active"))
    : t("subscription.inactive", "Inactive");

  return (
    <main className="page-gutter-x flex min-h-screen flex-col bg-black lg:flex-row">
      {/* 左侧边栏：移动端顶部紧凑，桌面端 30% */}
      <aside className="flex shrink-0 flex-col border-b border-zinc-800/80 bg-black/60 p-4 lg:w-[30%] lg:min-w-[240px] lg:max-w-[320px] lg:border-b-0 lg:border-r lg:py-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-zinc-700/80 lg:h-12 lg:w-12" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">
              {isLoggedIn ? (userId ?? t("profile.user")) : t("profile.guest")}
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
              {t("profile.logout")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setAuthOpen(true)}
              className="touch-target shrink-0 rounded-lg bg-red-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-red-500"
            >
              {t("profile.login")}
            </button>
          )}
        </div>

        {/* VIP Status + Days Remaining */}
        <div className="mt-3 rounded-xl border border-zinc-700/80 bg-zinc-900/60 p-3 lg:mt-4 lg:p-4">
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            <div>
              <p className="text-xs font-medium text-zinc-400">
                {t("subscription.status", "VIP Status")}
              </p>
              <p className="mt-0.5 text-base font-bold text-white lg:mt-1 lg:text-xl">{vipStatusText}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-400">
                {t("subscription.daysRemaining", "Days Remaining")}
              </p>
              <p className="mt-0.5 text-base font-bold text-white lg:mt-1 lg:text-xl">{getDaysRemaining()}</p>
            </div>
          </div>
          <Link
            href="/store"
            className="mt-3 block w-full rounded-2xl bg-red-600 py-2.5 text-center text-sm font-semibold text-white hover:bg-red-500 lg:mt-4 lg:py-3"
          >
            {t("profile.toStore")}
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
              {t("profile.history", "History")}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {t("profile.watchedHistory", "Watched History")}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {watchedHistory.length ? (
                watchedHistory.map((row) => (
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
                      <Image
                        src={row.series.poster || row.series.cover}
                        alt={getSeriesI18nText(row.series, lang).title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        className="object-cover"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                      <div className="pointer-events-none absolute bottom-0 left-0 right-0 p-3">
                        <p className="line-clamp-2 text-sm font-bold text-white">
                          {getSeriesI18nText(row.series, lang).title}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-300">
                          {lang === "zh-CN"
                            ? t("series.episodeLabelZh", { index: row.episode.index })
                            : t("series.episodeLabel", { index: row.episode.index })}{" "}
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
                    {t("profile.nothingInside", "Nothing inside...")}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "mylist" && (
          <section>
            <h1 className="text-lg font-bold text-white">
              {t("profile.myList", "My list")}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {t("profile.likedShows", "Liked shows")}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {favoriteSeries.length ? (
                favoriteSeries.map((series) => (
                  <button
                    key={series.id}
                    type="button"
                    onClick={() => router.push(`/series/${series.id}`)}
                    className="group w-full text-left"
                  >
                    <div className="relative poster-aspect overflow-hidden rounded-xl bg-zinc-900 transition-transform duration-200 group-hover:scale-[1.02] group-hover:shadow-[0_0_24px_rgba(229,9,20,0.25)]">
                      <Image
                        src={series.poster || series.cover}
                        alt={getSeriesI18nText(series, lang).title}
                        fill
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        className="object-cover"
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
                    {t("profile.nothingInside", "Nothing inside...")}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "wallet" && (
          <section>
            <h1 className="text-lg font-bold text-white">
              {t("profile.wallet", "Wallet")}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {t("profile.transactionHistory", "Transaction History")}
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-700/80 bg-zinc-900/50">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="border-b border-zinc-700/80">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">
                      {t("profile.date", "Date")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">
                      {t("profile.amount", "Amount")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">
                      {t("profile.tier", "Tier")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">
                      {t("profile.tradingHours", "Time")}
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
                          {t("profile.nothingInside", "Nothing inside...")}
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
