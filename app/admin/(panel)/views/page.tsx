"use client";

import { useEffect, useState } from "react";
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
  const [historyByClient, setHistoryByClient] = useState<Record<string, WatchEntry[]>>({});
  const [favoritesByClient, setFavoritesByClient] = useState<Record<string, string[]>>({});
  const [likesByClient, setLikesByClient] = useState<Record<string, string[]>>({});
  const [viewsByClient, setViewsByClient] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch("/admin/api/history").then((r) => r.json()).catch(() => ({})),
      fetch("/admin/api/favorites").then((r) => r.json()).catch(() => ({})),
      fetch("/admin/api/likes").then((r) => r.json()).catch(() => ({})),
      fetch("/admin/api/views").then((r) => r.json()).catch(() => ({}))
    ])
      .then(([historyJson, favoritesJson, likesJson, viewsJson]) => {
        if (cancelled) return;
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
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      <h1 className="text-xl font-bold text-zinc-100">{t("admin.watchInfoManagement")}</h1>
      <p className="mt-1 text-sm text-zinc-400">{t("admin.viewsHint")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tabBtn("history", t("admin.watchHistory"))}
        {tabBtn("favorites", t("admin.userFavorites"))}
        {tabBtn("likes", t("admin.userLikes"))}
        {tabBtn("views", t("admin.userViews"))}
      </div>

      {activeTab === "history" ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-700/80 bg-zinc-900/50">
          {loading ? (
            <div className="p-8 text-center text-zinc-500">{t("admin.loading")}</div>
          ) : historyRows.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">{t("admin.noHistoryYet")}</div>
          ) : (
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-zinc-700/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.clientId")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.series")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.episode")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.progress")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.lastWatched")}</th>
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
            <div className="p-8 text-center text-zinc-500">{t("admin.loading")}</div>
          ) : favRows.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">{t("admin.noFavoritesYet")}</div>
          ) : (
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-zinc-700/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.clientId")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.seriesId")}</th>
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
            <div className="p-8 text-center text-zinc-500">{t("admin.loading")}</div>
          ) : likeRows.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">{t("admin.noLikesYet")}</div>
          ) : (
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-zinc-700/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.clientId")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.seriesId")}</th>
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
            <div className="p-8 text-center text-zinc-500">{t("admin.loading")}</div>
          ) : viewRows.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">{t("admin.noViewsYet")}</div>
          ) : (
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-zinc-700/80">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.clientId")}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.seriesId")}</th>
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
