"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

interface WatchEntry {
  seriesId: string;
  episodeIndex: number;
  seconds: number;
  lastWatchedAt: string;
}

export default function AdminHistoryPage() {
  const { t } = useTranslation();
  const [byClient, setByClient] = useState<Record<string, WatchEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 10000);
    fetch("/admin/api/history", { signal: ctrl.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && json.byClient) {
          setByClient(json.byClient);
        } else {
          setByClient({});
          setLoadError(String(t("common.admin.submitFailed")));
        }
      })
      .catch(() => {
        setByClient({});
        setLoadError(String(t("common.admin.networkError")));
      })
      .finally(() => {
        window.clearTimeout(timer);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entries = Object.entries(byClient).flatMap(([clientId, list]) =>
    (list ?? []).map((e) => ({ clientId, ...e }))
  );

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-100">{t("common.admin.historyTitle")}</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {t("common.admin.historyHint")}
      </p>
      {loadError ? (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/20"
          >
            {t("common.admin.query")}
          </button>
        </div>
      ) : null}
      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-700/80 bg-zinc-900/50">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">{t("common.admin.loading")}</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">{t("common.admin.noHistoryYet")}</div>
        ) : (
          <table className="w-full min-w-[500px]">
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
              {entries.slice(0, 100).map((e, i) => (
                <tr key={i} className="border-b border-zinc-800/60 last:border-0">
                  <td className="px-4 py-3 text-sm text-zinc-300">{e.clientId}</td>
                  <td className="px-4 py-3 text-sm text-white">{e.seriesId}</td>
                  <td className="px-4 py-3 text-sm text-white">{e.episodeIndex}</td>
                  <td className="px-4 py-3 text-sm text-zinc-400">{e.seconds}s</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{e.lastWatchedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
