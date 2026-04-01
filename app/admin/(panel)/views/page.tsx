"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type WatchEntry = {
  seriesId: string;
  episodeIndex: number;
  seconds: number;
  lastWatchedAt: string;
};

type TabId = "history" | "favorites" | "likes" | "views";

export default function AdminViewsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabId>("history");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [historyByClient, setHistoryByClient] = useState<Record<string, WatchEntry[]>>({});
  const [favoritesByClient, setFavoritesByClient] = useState<Record<string, string[]>>({});
  const [likesByClient, setLikesByClient] = useState<Record<string, string[]>>({});
  const [viewsByClient, setViewsByClient] = useState<Record<string, string[]>>({});

  const loadAll = useCallback(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 10000);
    setLoading(true);
    setLoadError(null);
    const safeJson = (url: string) =>
      fetch(url, { signal: ctrl.signal, cache: "no-store" })
        .then((r) => r.json())
        .catch(() => ({}));
    Promise.all([
      safeJson("/admin/api/history"),
      safeJson("/admin/api/favorites"),
      safeJson("/admin/api/likes"),
      safeJson("/admin/api/views")
    ])
      .then(([historyJson, favoritesJson, likesJson, viewsJson]) => {
        if (cancelled) return;
        const anyOk = Boolean(
          historyJson?.ok || favoritesJson?.ok || likesJson?.ok || viewsJson?.ok
        );
        if (!anyOk) {
          setLoadError(String(t("common.admin.submitFailed")));
        }
        setHistoryByClient(
          historyJson?.ok && historyJson.byClient
            ? (historyJson.byClient as Record<string, WatchEntry[]>)
            : {}
        );
        setFavoritesByClient(
          favoritesJson?.ok && favoritesJson.byClient
            ? (favoritesJson.byClient as Record<string, string[]>)
            : {}
        );
        setLikesByClient(
          likesJson?.ok && likesJson.byClient ? (likesJson.byClient as Record<string, string[]>) : {}
        );
        setViewsByClient(
          viewsJson?.ok && viewsJson.byClient ? (viewsJson.byClient as Record<string, string[]>) : {}
        );
      })
      .finally(() => {
        window.clearTimeout(timer);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [t]);

  useEffect(() => {
    const cleanup = loadAll();
    return cleanup;
  }, [loadAll]);

  const historyRows = Object.entries(historyByClient).flatMap(([clientId, list]) =>
    (list ?? []).map((e) => ({ clientId, ...e }))
  );
  const favRows = Object.entries(favoritesByClient).flatMap(([clientId, seriesIds]) =>
    (seriesIds ?? []).map((seriesId) => ({ clientId, seriesId }))
  );
  const likeRows = Object.entries(likesByClient).flatMap(([clientId, seriesIds]) =>
    (seriesIds ?? []).map((seriesId) => ({ clientId, seriesId }))
  );
  const viewRows = Object.entries(viewsByClient).flatMap(([clientId, seriesIds]) =>
    (seriesIds ?? []).map((seriesId) => ({ clientId, seriesId }))
  );

  const tabBtn = (id: TabId, label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={[
        "rounded-full px-4 py-2 text-sm font-semibold transition",
        activeTab === id
          ? "bg-brand/20 text-brand ring-1 ring-brand/40"
          : "bg-zinc-900/60 text-zinc-300 ring-1 ring-zinc-800/80 hover:bg-zinc-800/80"
      ].join(" ")}
    >
      {label}
    </button>
  );

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-100">{t("common.admin.watchInfoManagement")}</h1>
      <p className="mt-1 text-sm text-zinc-400">{t("common.admin.viewsHint")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tabBtn("history", t("common.admin.watchHistory"))}
        {tabBtn("favorites", t("common.admin.userFavorites"))}
        {tabBtn("likes", t("common.admin.userLikes"))}
        {tabBtn("views", t("common.admin.userViews"))}
      </div>

      {loadError ? (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={loadAll}
            className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/20"
          >
            {t("common.admin.query")}
          </button>
        </div>
      ) : null}

      {activeTab === "history" ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-700/80 bg-zinc-900/50">
          {loading ? (
            <div className="p-8 text-center text-zinc-500">{t("common.admin.loading")}</div>
          ) : historyRows.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">{t("common.admin.noHistoryYet")}</div>
          ) : (
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-zinc-700/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.clientId")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.series")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.episode")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.progress")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.lastWatched")}</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-b border-zinc-800/60 last:border-0">
                    <td className="px-4 py-3 text-sm text-zinc-300">{r.clientId}</td>
                    <td className="px-4 py-3 text-sm text-white">{r.seriesId}</td>
                    <td className="px-4 py-3 text-sm text-white">{r.episodeIndex}</td>
                    <td className="px-4 py-3 text-sm text-zinc-300">{r.seconds}s</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{r.lastWatchedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {activeTab === "favorites" ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-700/80 bg-zinc-900/50">
          {loading ? (
            <div className="p-8 text-center text-zinc-500">{t("common.admin.loading")}</div>
          ) : favRows.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">{t("common.admin.noFavoritesYet")}</div>
          ) : (
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-zinc-700/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.clientId")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.seriesId")}</th>
                </tr>
              </thead>
              <tbody>
                {favRows.map((r, i) => (
                  <tr key={i} className="border-b border-zinc-800/60 last:border-0">
                    <td className="px-4 py-3 text-sm text-zinc-300">{r.clientId}</td>
                    <td className="px-4 py-3 text-sm text-white">{r.seriesId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {activeTab === "likes" ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-700/80 bg-zinc-900/50">
          {loading ? (
            <div className="p-8 text-center text-zinc-500">{t("common.admin.loading")}</div>
          ) : likeRows.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">{t("common.admin.noLikesYet")}</div>
          ) : (
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-zinc-700/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.clientId")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.seriesId")}</th>
                </tr>
              </thead>
              <tbody>
                {likeRows.map((r, i) => (
                  <tr key={i} className="border-b border-zinc-800/60 last:border-0">
                    <td className="px-4 py-3 text-sm text-zinc-300">{r.clientId}</td>
                    <td className="px-4 py-3 text-sm text-white">{r.seriesId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {activeTab === "views" ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-700/80 bg-zinc-900/50">
          {loading ? (
            <div className="p-8 text-center text-zinc-500">{t("common.admin.loading")}</div>
          ) : viewRows.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">{t("common.admin.noViewsYet")}</div>
          ) : (
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-zinc-700/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.clientId")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.seriesId")}</th>
                </tr>
              </thead>
              <tbody>
                {viewRows.map((r, i) => (
                  <tr key={i} className="border-b border-zinc-800/60 last:border-0">
                    <td className="px-4 py-3 text-sm text-zinc-300">{r.clientId}</td>
                    <td className="px-4 py-3 text-sm text-white">{r.seriesId}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}
