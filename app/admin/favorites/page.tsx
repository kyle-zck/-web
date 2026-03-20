"use client";

import { useEffect, useState } from "react";

export default function AdminFavoritesPage() {
  const [byClient, setByClient] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/admin/api/favorites")
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && json.byClient) {
          setByClient(json.byClient);
        }
      })
      .catch(() => setByClient({}))
      .finally(() => setLoading(false));
  }, []);

  const rows = Object.entries(byClient).flatMap(([clientId, seriesIds]) =>
    (seriesIds ?? []).map((seriesId) => ({ clientId, seriesId }))
  );

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-100">User Favorites (My list)</h1>
      <p className="mt-1 text-sm text-zinc-400">
        Liked series per user. My list tab shows this data.
      </p>
      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-700/80 bg-zinc-900/50">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">No favorites yet.</div>
        ) : (
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-zinc-700/80">
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">Client ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">Series ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-zinc-800/60 last:border-0">
                  <td className="px-4 py-3 text-sm text-zinc-300">{r.clientId}</td>
                  <td className="px-4 py-3 text-sm text-white">{r.seriesId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
