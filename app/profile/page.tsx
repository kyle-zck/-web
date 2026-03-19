"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthModal } from "@/components/ui/auth-modal";
import { Modal } from "@/components/ui/modal";
import { usePlayerStore } from "@/lib/store/player";
import { useUserStore } from "@/lib/store/user";
import type { Series } from "@/constants/mock-data";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { AppLanguage } from "@/lib/i18n/languages";
import { getSeriesI18nText } from "@/lib/i18n/seriesText";
import { getTagKey } from "@/lib/i18n/tagKey";

function formatSeconds(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function ProfilePage() {
  const router = useRouter();
  const { isLoggedIn, userId, logout } = useUserStore();
  const { coinBalance, progressSeconds, setEpisodeIndex, setSeries } =
    usePlayerStore();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;

  const [authOpen, setAuthOpen] = useState(false);
  const [adOpen, setAdOpen] = useState(false);
  const [seriesList, setSeriesList] = useState<Series[]>([]);

  useEffect(() => {
    fetch("/api/series")
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.series)) {
          setSeriesList(json.series as Series[]);
        }
      })
      .catch(() => {
        setSeriesList([]);
      });
  }, []);

  const watchedHistory = useMemo(() => {
    const rows = Object.entries(progressSeconds)
      .map(([key, seconds]) => {
        const [seriesId, idx] = key.split("::");
        const episodeIndex = Number(idx);
        const series = seriesList.find((s) => s.id === seriesId);
        const episode = series?.episodes.find((e) => e.index === episodeIndex);
        if (!series || !episode) return null;
        if (seconds <= 0) return null;
        return { series, episode, seconds };
      })
      .filter(Boolean) as Array<{
      series: Series;
      episode: Series["episodes"][number];
      seconds: number;
    }>;

    rows.sort((a, b) => b.seconds - a.seconds);
    return rows.slice(0, 12);
  }, [progressSeconds, seriesList]);

  return (
    <main className="flex min-h-screen flex-col">
      <header className="px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-zinc-100">
              {t("profile.myTitle")}
            </h1>
            <p className="mt-1 text-xs text-zinc-400">
              {t("profile.manageSubtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn ? (
              <button
                type="button"
                onClick={logout}
                className="rounded-full bg-zinc-900/60 px-3 py-2 text-xs font-semibold text-zinc-200 ring-1 ring-zinc-800/80 hover:text-white"
              >
                {t("profile.logout")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="rounded-full bg-brand px-3 py-2 text-xs font-semibold text-white shadow-soft-glow"
              >
                {t("profile.login")}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 pb-24 pt-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <section className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
            <p className="text-xs font-semibold text-zinc-400">
              {t("profile.userId")}
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-100">
              {isLoggedIn ? userId : t("profile.notLoggedIn")}
            </p>

            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-400">
                  {t("profile.coinBalance")}
                </p>
                <p className="mt-1 text-xl font-extrabold text-white">
                  {coinBalance}{" "}
                  <span className="text-sm font-bold text-zinc-400">
                    {t("profile.coins")}
                  </span>
                </p>
              </div>
              <Link
                href="/store"
                className="rounded-2xl bg-brand/15 px-3 py-2 text-xs font-semibold text-brand ring-1 ring-brand/40 hover:bg-brand/20"
              >
                {t("profile.toStore")}
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setAdOpen(true)}
              className={cn(
                "mt-4 w-full rounded-2xl border border-zinc-800/80 bg-black/30 px-4 py-3 text-sm font-semibold text-zinc-100",
                "hover:border-brand/60"
              )}
            >
              {t("profile.watchAdToEarn")}
            </button>
            <p className="mt-2 text-[11px] leading-5 text-zinc-500">
              {t("profile.earnAdHint")}
            </p>
          </section>

          <section className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4 sm:col-span-1">
            <p className="text-xs font-semibold text-zinc-400">
              {t("profile.watchedHistory")}
            </p>
            <p className="mt-1 text-sm font-semibold text-zinc-100">
              {watchedHistory.length
                ? t("profile.watchHistoryCount", { count: watchedHistory.length })
                : t("profile.noHistory")}
            </p>
            <div className="mt-3 space-y-2">
              {watchedHistory.length ? (
                watchedHistory.slice(0, 5).map((row) => (
                  <button
                    key={`${row.series.id}-${row.episode.id}`}
                    type="button"
                    onClick={() => {
                      setSeries(row.series.id);
                      setEpisodeIndex(row.episode.index);
                      router.push(`/series/${row.series.id}`);
                    }}
                    className="w-full rounded-2xl border border-zinc-800/80 bg-black/30 px-3 py-2 text-left hover:border-brand/60"
                  >
                    <p className="text-xs font-semibold text-zinc-100">
                      {lang === "zh-CN"
                        ? t("series.episodeLabelZh", { index: row.episode.index })
                        : t("series.episodeLabel", { index: row.episode.index })}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-400">
                      {getSeriesI18nText(row.series, lang).title} ·{" "}
                      {t("profile.watchedAt", { time: formatSeconds(row.seconds) })}
                    </p>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-zinc-800/80 bg-black/30 p-3 text-xs text-zinc-400">
                  {t("profile.emptyGrid")}
                </div>
              )}
            </div>
            {watchedHistory.length ? (
              <button
                type="button"
                onClick={() => router.push("/")}
                className="mt-3 w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-soft-glow"
              >
                {t("profile.goToMore")}
              </button>
            ) : null}
          </section>
        </div>

        <section className="mt-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-zinc-400">
                {t("profile.moreHistory")}
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">
                {t("profile.recentUpdates")}
              </p>
            </div>
            <div className="text-xs text-zinc-500">{t("profile.topN", { count: 12 })}</div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {watchedHistory.length ? (
              watchedHistory.map((row) => (
                <button
                  key={`grid-${row.series.id}-${row.episode.id}`}
                  type="button"
                  onClick={() => {
                    setSeries(row.series.id);
                    setEpisodeIndex(row.episode.index);
                    router.push(`/series/${row.series.id}`);
                  }}
                  className="rounded-2xl border border-zinc-800/80 bg-black/30 p-3 text-left hover:border-brand/60"
                >
                  <p className="line-clamp-2 text-xs font-semibold text-zinc-100">
                  {lang === "zh-CN"
                    ? t("series.episodeLabelZh", { index: row.episode.index })
                    : t("series.episodeLabel", { index: row.episode.index })}
                  </p>
                  <p className="mt-1 text-[11px] text-zinc-400">
                  {t(`tags.${getTagKey(row.series.category)}`)} ·{" "}
                  {formatSeconds(row.seconds)}
                  </p>
                </button>
              ))
            ) : (
              <div className="col-span-2 rounded-2xl border border-zinc-800/80 bg-black/30 p-3 text-xs text-zinc-400 sm:col-span-3">
              {t("profile.noGridContent")}
              </div>
            )}
          </div>
        </section>
      </div>


      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <Modal
        open={adOpen}
        onClose={() => setAdOpen(false)}
        title={t("profile.earnCoinsDemoTitle")}
        footer={
          <button
            type="button"
            onClick={() => setAdOpen(false)}
            className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-soft-glow"
          >
            {t("profile.iKnow")}
          </button>
        }
      >
        <p className="text-sm text-zinc-300">
          {t("profile.earnCoinsDemoBody")}
        </p>
      </Modal>
    </main>
  );
}
