"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { UploadSeriesForm } from "@/components/admin/upload-series-form";
import type { Series } from "@/constants/mock-data";

function formatTags(tags: string[]) {
  return tags.slice(0, 3);
}

export default function AdminSeriesPage() {
  const [series, setSeries] = useState<Series[]>([]);

  const load = async () => {
    const res = await fetch("/admin/api/series");
    const json = await res.json();
    if (!res.ok || !json.ok) throw new Error("load failed");
    setSeries(json.series as Series[]);
  };

  useEffect(() => {
    load().catch(() => {
      setSeries([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sorted = useMemo(() => {
    return [...series].sort((a, b) => b.episodes.length - a.episodes.length);
  }, [series]);

  return (
    <main>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-zinc-100">Series Management</h1>
          <p className="mt-1 text-xs text-zinc-400">列表 + 上传（写入本地存储 Demo）</p>
        </div>
        <Badge variant="pill" className="bg-zinc-950 text-zinc-200 ring-1 ring-zinc-800/80">
          Total: {series.length}
        </Badge>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">All Series</h2>
            <p className="text-xs text-zinc-500">Table view</p>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[540px] border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-[11px] text-zinc-500">
                  <th className="px-2 py-1 font-semibold">Cover</th>
                  <th className="px-2 py-1 font-semibold">Title</th>
                  <th className="px-2 py-1 font-semibold">Tags</th>
                  <th className="px-2 py-1 font-semibold">Episodes</th>
                  <th className="px-2 py-1 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => (
                  <tr key={s.id} className="text-sm">
                    <td className="px-2">
                      <div className="relative h-12 w-10 overflow-hidden rounded-xl border border-zinc-800/80 bg-black/30">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={s.cover}
                          alt={s.title}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </td>
                    <td className="px-2">
                      <div className="min-w-[150px]">
                        <p className="line-clamp-1 font-semibold text-zinc-100">{s.title}</p>
                        <p className="mt-1 text-[11px] text-zinc-500 line-clamp-1">{s.category}</p>
                      </div>
                    </td>
                    <td className="px-2">
                      <div className="flex flex-wrap gap-1.5">
                        {formatTags(s.tags).map((t) => (
                          <Badge key={t} variant="outline" className="bg-black/20">
                            {t}
                          </Badge>
                        ))}
                        {s.tags.length > 3 ? (
                          <span className="text-[11px] text-zinc-500">+{s.tags.length - 3}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-2">
                      <p className="text-zinc-100 font-semibold">{s.episodes.length}</p>
                    </td>
                    <td className="px-2">
                      <button
                        type="button"
                        onClick={() => {
                          const ok = confirm(`确定删除：${s.title}？`);
                          if (!ok) return;
                          fetch(`/admin/api/series/${s.id}`, { method: "DELETE" })
                            .then((r) => r.json())
                            .then(() => load())
                            .catch(() => load());
                        }}
                        className="rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] font-semibold text-red-200 hover:border-red-500/50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {!sorted.length ? (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-xs text-zinc-500">
                      No series yet. Please upload one.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <UploadSeriesForm onUploaded={load} />
        </section>
      </div>
    </main>
  );
}

