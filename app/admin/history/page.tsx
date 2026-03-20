"use client";

import { useEffect, useState } from "react";

interface WatchEntry {
  seriesId: string;
  episodeIndex: number;
  seconds: number;
  lastWatchedAt: string;
}

export default function AdminHistoryPage() {
  const [byClient, setByClient] = useState<Record<string, WatchEntry[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/admin/api/history")
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && json.byClient) {
          setByClient(json.byClient);
        }
      })
      .catch(() => setByClient({}))
      .finally(() => setLoading(false));
  }, []);

  const entries = Object.entries(byClient).flatMap(([clientId, list]) =>
    (list ?? []).map((e) => ({ clientId, ...e }))
  );

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-100">Watch History</h1>
      <p className="mt-1 text-sm text-zinc-400">
        User watch history (synced from profile). History tab shows this data.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-700/80 bg-zinc-900/50">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">No watch history yet.</div>
        ) : (
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-zinc-700/80">
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">Client ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">Series</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">Episode</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">Progress</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">Last Watched</th>
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
