"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "@/components/ui/toast";
import { translateAdminApiError } from "@/lib/admin/api-error";
import { fetchAdminJson } from "@/lib/admin/fetch-admin-json";
import type { Episode, Series } from "@/constants/mock-data";
import { cn } from "@/lib/utils";

type Row = { series: Series; episode: Episode };

function statusTone(status: Episode["videoStatus"]) {
  if (status === "ready") return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40";
  if (status === "failed") return "bg-red-500/15 text-red-300 ring-red-500/40";
  return "bg-amber-500/15 text-amber-300 ring-amber-500/40";
}

export default function AdminEpisodeManagementPage() {
  const { t } = useTranslation();
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("");
  const [draft, setDraft] = useState({ dramaId: "", originalName: "", title: "" });
  const [applied, setApplied] = useState({ dramaId: "", originalName: "", title: "" });
  const [refreshingEpisodeId, setRefreshingEpisodeId] = useState<string | null>(null);
  const [batchRefreshing, setBatchRefreshing] = useState(false);
  const [checkingEpisodeId, setCheckingEpisodeId] = useState<string | null>(null);
  const [batchChecking, setBatchChecking] = useState(false);
  const [resourceHealth, setResourceHealth] = useState<
    Record<
      string,
      {
        cover?: { ok: boolean; status: number };
        videoUrl?: { ok: boolean; status: number };
        videoPlaybackUrl?: { ok: boolean; status: number };
      }
    >
  >({});

  const load = useCallback(async () => {
    try {
      const { res, json } = await fetchAdminJson<{ ok?: boolean; series?: Series[] }>(
        "/admin/api/series"
      );
      if (res.ok && json?.ok && Array.isArray(json.series)) setSeries(json.series);
      else setSeries([]);
    } catch {
      setSeries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  const handleQuery = () => {
    setApplied({
      dramaId: draft.dramaId.trim(),
      originalName: draft.originalName.trim(),
      title: draft.title.trim()
    });
  };

  const handleReset = () => {
    setDraft({ dramaId: "", originalName: "", title: "" });
    setApplied({ dramaId: "", originalName: "", title: "" });
  };

  const filteredSeries = useMemo(() => {
    return series.filter((s) => {
      if (applied.dramaId) {
        const idStr = String(s.dramaId ?? "");
        if (!idStr.toLowerCase().includes(applied.dramaId.toLowerCase())) return false;
      }
      if (applied.originalName) {
        const q = applied.originalName.toLowerCase();
        if (!(s.originalName ?? "").toLowerCase().includes(q)) return false;
      }
      if (applied.title) {
        const q = applied.title.toLowerCase();
        if (!s.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [series, applied]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const s of filteredSeries) {
      for (const e of s.episodes ?? []) {
        out.push({ series: s, episode: e });
      }
    }
    return out;
  }, [filteredSeries]);

  const processingRows = useMemo(
    () =>
      rows.filter(
        ({ episode }) => episode.videoStatus === "processing" && Boolean(episode.videoStreamId)
      ),
    [rows]
  );

  const deleteEpisode = async (s: Series, e: Episode) => {
    const ok = confirm(t("admin.confirmDeleteEpisode", { title: s.title, n: e.index }));
    if (!ok) return;
    try {
      const res = await fetch(`/admin/api/series/${s.id}/episodes/${e.id}`, {
        method: "DELETE"
      });
      const json = await res.json();
      if (!json?.ok) {
        showToast(translateAdminApiError(json, t, "admin.episodeDeleteFailed"));
        return;
      }
      showToast(t("admin.episodeDeleted"), "success");
      await load();
    } catch {
      showToast(t("admin.networkErrorShort"));
    }
  };

  const refreshEpisodeStatus = async (s: Series, e: Episode) => {
    if (!e.videoStreamId) {
      showToast(t("admin.videoStatusNoStreamId"), "info");
      return;
    }
    setRefreshingEpisodeId(e.id);
    try {
      const res = await fetch("/api/video/stream-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId: s.id,
          episodeId: e.id,
          streamId: e.videoStreamId
        })
      });
      const json = (await res.json()) as { ok?: boolean };
      if (!res.ok || !json?.ok) {
        showToast(t("admin.videoStatusRefreshFailed"));
        return;
      }
      await load();
      showToast(t("admin.videoStatusRefreshed"), "success");
    } catch {
      showToast(t("admin.networkErrorShort"));
    } finally {
      setRefreshingEpisodeId(null);
    }
  };

  const refreshProcessingEpisodes = async () => {
    if (processingRows.length === 0) {
      showToast(t("admin.videoStatusNoProcessing"), "info");
      return;
    }
    setBatchRefreshing(true);
    let okCount = 0;
    try {
      const queue = [...processingRows];
      const concurrency = 4;
      const workers = Array.from({ length: Math.min(concurrency, queue.length) }).map(
        async () => {
          while (queue.length > 0) {
            const item = queue.shift();
            if (!item) break;
            const { series: s, episode: e } = item;
            try {
              const res = await fetch("/api/video/stream-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  seriesId: s.id,
                  episodeId: e.id,
                  streamId: e.videoStreamId
                })
              });
              const json = (await res.json()) as { ok?: boolean };
              if (res.ok && json?.ok) okCount += 1;
            } catch {
              // ignore single item error and continue
            }
          }
        }
      );
      await Promise.all(workers);
      await load();
      showToast(
        t("admin.videoStatusBatchRefreshed", {
          ok: okCount,
          total: processingRows.length
        }),
        "success"
      );
    } catch {
      showToast(t("admin.videoStatusRefreshFailed"));
    } finally {
      setBatchRefreshing(false);
    }
  };

  const checkEpisodeResources = async (s: Series, e: Episode) => {
    setCheckingEpisodeId(e.id);
    try {
      const res = await fetch("/admin/api/video/check-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            { kind: "cover", url: s.cover },
            { kind: "videoUrl", url: e.videoUrl },
            { kind: "videoPlaybackUrl", url: e.videoPlaybackUrl || e.videoUrl }
          ]
        })
      });
      const json = (await res.json()) as {
        ok?: boolean;
        results?: Array<{
          kind: "cover" | "videoUrl" | "videoPlaybackUrl";
          ok: boolean;
          status: number;
        }>;
      };
      if (!res.ok || !json?.ok || !Array.isArray(json.results)) {
        showToast(t("admin.videoHealthCheckFailed"));
        return;
      }
      const next = json.results.reduce(
        (acc, item) => {
          acc[item.kind] = { ok: item.ok, status: item.status };
          return acc;
        },
        {} as {
          cover?: { ok: boolean; status: number };
          videoUrl?: { ok: boolean; status: number };
          videoPlaybackUrl?: { ok: boolean; status: number };
        }
      );
      setResourceHealth((prev) => ({ ...prev, [e.id]: next }));
      showToast(t("admin.videoHealthChecked"), "success");
    } catch {
      showToast(t("admin.networkErrorShort"));
    } finally {
      setCheckingEpisodeId(null);
    }
  };

  const checkVisibleResources = async () => {
    if (rows.length === 0) {
      showToast(t("admin.noEpisodeRows"), "info");
      return;
    }
    setBatchChecking(true);
    let okCount = 0;
    try {
      const queue = [...rows];
      const concurrency = 4;
      const workers = Array.from({ length: Math.min(concurrency, queue.length) }).map(
        async () => {
          while (queue.length > 0) {
            const item = queue.shift();
            if (!item) break;
            const { series: s, episode: e } = item;
            try {
              const res = await fetch("/admin/api/video/check-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  items: [
                    { kind: "cover", url: s.cover },
                    { kind: "videoUrl", url: e.videoUrl },
                    { kind: "videoPlaybackUrl", url: e.videoPlaybackUrl || e.videoUrl }
                  ]
                })
              });
              const json = (await res.json()) as {
                ok?: boolean;
                results?: Array<{
                  kind: "cover" | "videoUrl" | "videoPlaybackUrl";
                  ok: boolean;
                  status: number;
                }>;
              };
              if (!res.ok || !json?.ok || !Array.isArray(json.results)) continue;
              const next = json.results.reduce(
                (acc, x) => {
                  acc[x.kind] = { ok: x.ok, status: x.status };
                  return acc;
                },
                {} as {
                  cover?: { ok: boolean; status: number };
                  videoUrl?: { ok: boolean; status: number };
                  videoPlaybackUrl?: { ok: boolean; status: number };
                }
              );
              setResourceHealth((prev) => ({ ...prev, [e.id]: next }));
              okCount += 1;
            } catch {
              // ignore
            }
          }
        }
      );
      await Promise.all(workers);
      showToast(t("admin.videoHealthBatchChecked", { ok: okCount, total: rows.length }), "success");
    } catch {
      showToast(t("admin.videoHealthCheckFailed"));
    } finally {
      setBatchChecking(false);
    }
  };

  const localHref = (e: Episode) =>
    (e.localVideoUrl && e.localVideoUrl.trim()) || e.videoUrl;

  /** 浏览器可直接打开的公网/本机 HTTP(S) 视频地址（非 file://） */
  const playableStreamUrl = (e: Episode): string | null => {
    const u = e.videoUrl?.trim();
    if (!u) return null;
    if (/^https:\/\//i.test(u)) return u;
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(u)) return u;
    return null;
  };

  const siteHref = (s: Series, e: Episode) =>
    `${origin}/series/${encodeURIComponent(s.id)}?episode=${e.index}`;

  const statusLabel = (status: Episode["videoStatus"]) => {
    if (status === "ready") return t("admin.videoStatusReady");
    if (status === "failed") return t("admin.videoStatusFailed");
    return t("admin.videoStatusProcessing");
  };

  return (
    <main>
      <p className="text-xs font-medium text-zinc-500">{t("admin.dramaResourceManagement")}</p>
      <h4 className="mt-1 text-base font-bold text-zinc-100">{t("admin.episodeManagement")}</h4>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
        {t("admin.episodeManagementIntro")}
      </p>

      <section className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400">
            {t("admin.dramaIdFilter")}
          </label>
          <input
            type="text"
            value={draft.dramaId}
            onChange={(e) => setDraft((d) => ({ ...d, dramaId: e.target.value }))}
            placeholder={t("admin.dramaIdFilterPh")}
            className="mt-1 w-40 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-400">
            {t("admin.originalNameFilter")}
          </label>
          <input
            type="text"
            value={draft.originalName}
            onChange={(e) => setDraft((d) => ({ ...d, originalName: e.target.value }))}
            placeholder={t("admin.originalNameFilterPh")}
            className="mt-1 w-44 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-400">
            {t("admin.dramaTitleFilter")}
          </label>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder={t("admin.dramaTitleFilterPh")}
            className="mt-1 w-44 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={batchRefreshing || batchChecking}
            onClick={checkVisibleResources}
            className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50"
          >
            {batchChecking
              ? t("admin.videoHealthBatchChecking")
              : t("admin.videoHealthBatchCheck", { count: rows.length })}
          </button>
          <button
            type="button"
            disabled={batchRefreshing}
            onClick={refreshProcessingEpisodes}
            className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {batchRefreshing
              ? t("admin.videoStatusBatchRefreshing")
              : t("admin.videoStatusBatchRefresh", { count: processingRows.length })}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg border border-zinc-600 bg-zinc-800/60 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700/60"
          >
            {t("admin.reset")}
          </button>
          <button
            type="button"
            onClick={handleQuery}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            {t("admin.query")}
          </button>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/60">
        <div className="max-h-[calc(100vh-340px)] overflow-auto">
          {loading ? (
            <div className="py-12 text-center text-zinc-500">{t("admin.tableLoading")}</div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[1180px] border-collapse">
                <thead className="sticky top-0 z-10 border-b border-zinc-700/80 bg-zinc-900/95 backdrop-blur">
                  <tr className="text-left text-xs text-zinc-400">
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("admin.episodeColDramaId")}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("admin.episodeColIndex")}</th>
                    <th className="min-w-[100px] px-3 py-2 font-semibold">{t("admin.colOriginalName")}</th>
                    <th className="min-w-[100px] px-3 py-2 font-semibold">{t("admin.colDramaTitle")}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("admin.episodeColCover")}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("admin.episodeColStreamStatus")}</th>
                    <th className="min-w-[120px] px-3 py-2 font-semibold">{t("admin.episodeColLocalVideo")}</th>
                    <th className="min-w-[120px] px-3 py-2 font-semibold">{t("admin.episodeColSiteLink")}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("admin.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-zinc-500">
                        {t("admin.noEpisodeRows")}
                      </td>
                    </tr>
                  ) : (
                    rows.map(({ series: s, episode: e }) => (
                      <tr
                        key={`${s.id}-${e.id}`}
                        className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40"
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-sm font-mono text-zinc-200">
                          {s.dramaId ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-sm text-zinc-200">
                          <div className="whitespace-nowrap">{t("admin.episodeRowLabel", { n: e.index })}</div>
                          {e.sourceFileName ? (
                            <div
                              className="mt-0.5 max-w-[200px] truncate text-[11px] text-zinc-500"
                              title={e.sourceFileName}
                            >
                              {t("admin.episodeFileName", { name: e.sourceFileName })}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-sm text-zinc-300">
                          <span className="whitespace-nowrap" title={s.originalName ?? ""}>
                            {s.originalName ?? "—"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-sm text-zinc-200">
                          <span className="whitespace-nowrap" title={s.title}>
                            {s.title}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <a
                            href={s.cover}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-10 shrink-0"
                            title={t("admin.clickViewCover")}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={s.cover}
                              alt={s.title}
                              className="aspect-[3/4] h-12 w-10 rounded object-cover ring-1 ring-zinc-700/80"
                              loading="lazy"
                            />
                          </a>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span
                              className={[
                                "inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ring-1",
                                statusTone(e.videoStatus)
                              ].join(" ")}
                            >
                              {statusLabel(e.videoStatus)}
                            </span>
                            <button
                              type="button"
                              disabled={refreshingEpisodeId === e.id}
                              onClick={() => refreshEpisodeStatus(s, e)}
                              className="rounded-md border border-zinc-600 px-2 py-1 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-700/60 disabled:opacity-50"
                            >
                              {refreshingEpisodeId === e.id
                                ? t("admin.videoStatusRefreshing")
                                : t("admin.videoStatusRefresh")}
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <a
                            href={localHref(e)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:underline"
                            title={
                              e.localVideoUrl?.startsWith("file:")
                                ? t("admin.fileLinkBlockedHint")
                                : e.sourceFileName ?? t("admin.localResourceFallback")
                            }
                          >
                            {t("admin.openLocalResource")}
                          </a>
                          {playableStreamUrl(e) ? (
                            <a
                              href={playableStreamUrl(e)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 block text-xs text-emerald-400/90 hover:underline"
                              title={t("admin.episodeStreamUrlTitle")}
                            >
                              {t("admin.openStreamUrl")}
                            </a>
                          ) : null}
                          {resourceHealth[e.id]?.videoUrl ? (
                            <p
                              className={cn(
                                "mt-1 text-[10px]",
                                resourceHealth[e.id]?.videoUrl?.ok ? "text-emerald-400" : "text-red-400"
                              )}
                            >
                              videoUrl:{" "}
                              {resourceHealth[e.id]?.videoUrl?.ok
                                ? "OK"
                                : `ERR(${resourceHealth[e.id]?.videoUrl?.status ?? 0})`}
                            </p>
                          ) : null}
                          {resourceHealth[e.id]?.videoPlaybackUrl ? (
                            <p
                              className={cn(
                                "mt-0.5 text-[10px]",
                                resourceHealth[e.id]?.videoPlaybackUrl?.ok ? "text-emerald-400" : "text-red-400"
                              )}
                            >
                              playback:{" "}
                              {resourceHealth[e.id]?.videoPlaybackUrl?.ok
                                ? "OK"
                                : `ERR(${resourceHealth[e.id]?.videoPlaybackUrl?.status ?? 0})`}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          {origin ? (
                            <a
                              href={siteHref(s, e)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-emerald-400 hover:underline"
                            >
                              {t("admin.frontendPlayPage")}
                            </a>
                          ) : (
                            <span className="text-xs text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={checkingEpisodeId === e.id}
                              onClick={() => checkEpisodeResources(s, e)}
                              className="rounded-lg border border-cyan-500/50 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/15 disabled:opacity-50"
                            >
                              {checkingEpisodeId === e.id
                                ? t("admin.videoHealthChecking")
                                : t("admin.videoHealthCheck")}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteEpisode(s, e)}
                              className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/15"
                            >
                              {t("admin.delete")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
