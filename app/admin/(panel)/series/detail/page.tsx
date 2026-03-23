"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Series } from "@/constants/mock-data";
import { showToast } from "@/components/ui/toast";
import { DramaEditDrawer } from "@/components/admin/drama-edit-drawer";
import { fetchAdminJson } from "@/lib/admin/fetch-admin-json";
import { getSeriesVideoMode } from "@/lib/video/series-video-mode";

function formatDate(ts: number | undefined, locale: string) {
  if (!ts) return "—";
  const loc = locale.startsWith("zh") ? "zh-CN" : "en-US";
  return new Date(ts).toLocaleString(loc);
}

function buildTaskName(
  s: Series,
  unnamed: string,
  formatTs: (ts?: number) => string
) {
  const id = s.dramaId ?? "—";
  const name = s.title || unnamed;
  const time = formatTs(s.createdAt);
  return `${id}_${name}_${time}`;
}

export default function AdminDramaDetailPage() {
  const { t, i18n } = useTranslation();
  const formatTs = useCallback((ts?: number) => formatDate(ts, i18n.language), [i18n.language]);
  const taskLabel = useCallback(
    (s: Series) => buildTaskName(s, t("admin.unnamed"), formatTs),
    [formatTs, t]
  );
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<Series | null>(null);
  const [batchHlsRunning, setBatchHlsRunning] = useState(false);
  const [hotHlsRunning, setHotHlsRunning] = useState(false);
  const [hotMinViews, setHotMinViews] = useState(500);
  const [hotMaxSeries, setHotMaxSeries] = useState(20);
  const [firstNEpisodesPerSeries, setFirstNEpisodesPerSeries] = useState(0);

  const defaultFilter = {
    taskName: "",
    dramaId: "",
    title: "",
    localOrTranslated: "" as "" | "local" | "translated",
    tag: "",
    videoMode: "" as "" | "hls" | "mp4" | "mixed" | "processing",
    listed: "" as "" | "yes" | "no",
    sortBy: "createdAt" as "createdAt" | "completedAt" | "listedAt",
    sortOrder: "desc" as "asc" | "desc"
  };

  const [filter, setFilter] = useState(defaultFilter);
  const [appliedFilter, setAppliedFilter] = useState(defaultFilter);

  const load = async () => {
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
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = [...series];
    const f = appliedFilter;

    if (f.taskName) {
      const q = f.taskName.toLowerCase();
      list = list.filter((s) => taskLabel(s).toLowerCase().includes(q));
    }
    if (f.dramaId) {
      const q = String(f.dramaId);
      list = list.filter((s) => String(s.dramaId ?? "").includes(q));
    }
    if (f.title) {
      const q = f.title.toLowerCase();
      list = list.filter((s) => (s.title ?? "").toLowerCase().includes(q));
    }
    if (f.localOrTranslated) {
      list = list.filter((s) => s.localOrTranslated === f.localOrTranslated);
    }
    if (f.tag) {
      list = list.filter((s) => (s.tags ?? []).includes(f.tag as any));
    }
    if (f.videoMode) {
      list = list.filter((s) => getSeriesVideoMode(s) === f.videoMode);
    }
    if (f.listed === "yes") list = list.filter((s) => s.listed !== false);
    if (f.listed === "no") list = list.filter((s) => s.listed === false);

    const key = f.sortBy;
    list.sort((a, b) => {
      const va = (a as any)[key] ?? 0;
      const vb = (b as any)[key] ?? 0;
      const cmp = va - vb;
      return f.sortOrder === "asc" ? cmp : -cmp;
    });

    return list;
  }, [appliedFilter, series, taskLabel]);

  const handleReset = () => {
    setFilter(defaultFilter);
    setAppliedFilter(defaultFilter);
    showToast(t("admin.toastResetFilters"), "info");
  };

  const handleQuery = () => {
    setAppliedFilter(filter);
    showToast(t("admin.toastQueryFilters"), "info");
  };

  const handleDelete = async (s: Series) => {
    if (!confirm(t("admin.confirmDeleteDramaFull", { title: s.title }))) return;
    try {
      const res = await fetch(`/admin/api/series/${s.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json?.ok) {
        showToast(t("admin.deleteSuccess"), "success");
        load();
      } else {
        showToast(t("admin.deleteFailed"));
      }
    } catch {
      showToast(t("admin.networkErrorShort"));
    }
  };

  const handleEditSaved = () => {
    load();
    setEditTarget(null);
  };

  const runBatchHlsOnFiltered = async () => {
    const ids = filtered.map((s) => s.id);
    if (ids.length === 0) {
      showToast(t("admin.noDramasYetTable"), "info");
      return;
    }
    setBatchHlsRunning(true);
    try {
      const res = await fetch("/admin/api/video/transcode-hls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manual",
          seriesIds: ids,
          firstNEpisodesPerSeries
        })
      });
      const json = (await res.json()) as {
        ok?: boolean;
        okCount?: number;
        totalJobs?: number;
      };
      if (!res.ok || !json?.ok) {
        showToast(t("admin.hlsBatchRunFailed"));
        return;
      }
      showToast(
        t("admin.hlsBatchRunDone", {
          ok: json.okCount ?? 0,
          total: json.totalJobs ?? 0
        }),
        "success"
      );
      await load();
    } catch {
      showToast(t("admin.networkErrorShort"));
    } finally {
      setBatchHlsRunning(false);
    }
  };

  const runHotHls = async () => {
    setHotHlsRunning(true);
    try {
      const res = await fetch("/admin/api/video/transcode-hls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "hot",
          minViews: hotMinViews,
          maxSeries: hotMaxSeries,
          firstNEpisodesPerSeries
        })
      });
      const json = (await res.json()) as {
        ok?: boolean;
        okCount?: number;
        totalJobs?: number;
      };
      if (!res.ok || !json?.ok) {
        showToast(t("admin.hlsHotRunFailed"));
        return;
      }
      showToast(
        t("admin.hlsHotRunDone", {
          ok: json.okCount ?? 0,
          total: json.totalJobs ?? 0
        }),
        "success"
      );
      await load();
    } catch {
      showToast(t("admin.networkErrorShort"));
    } finally {
      setHotHlsRunning(false);
    }
  };

  const allTags = useMemo(() => {
    const set = new Set<string>();
    series.forEach((s) => (s.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set);
  }, [series]);

  return (
    <main className="flex flex-col">
      <h1 className="text-xl font-extrabold text-zinc-100">
        {t("admin.dramaDetail")}
      </h1>
      <p className="mt-1 text-xs text-zinc-400">{t("admin.dramaDetailIntro")}</p>

      <section className="mt-6 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400">{t("admin.labelTaskName")}</label>
            <input
              type="text"
              value={filter.taskName}
              onChange={(e) => setFilter({ ...filter, taskName: e.target.value })}
              placeholder={t("admin.phFuzzySearch")}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400">{t("admin.labelDramaIdFilter")}</label>
            <input
              type="text"
              value={filter.dramaId}
              onChange={(e) => setFilter({ ...filter, dramaId: e.target.value })}
              placeholder={t("admin.phNumberSearch")}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400">{t("admin.labelDramaTitleFilter")}</label>
            <input
              type="text"
              value={filter.title}
              onChange={(e) => setFilter({ ...filter, title: e.target.value })}
              placeholder={t("admin.phFuzzySearch")}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400">{t("admin.labelTypeShort")}</label>
            <select
              value={filter.localOrTranslated}
              onChange={(e) =>
                setFilter({ ...filter, localOrTranslated: e.target.value as typeof filter.localOrTranslated })
              }
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">{t("admin.allOption")}</option>
              <option value="local">{t("admin.localDrama")}</option>
              <option value="translated">{t("admin.translatedDrama")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400">{t("admin.tags")}</label>
            <select
              value={filter.tag}
              onChange={(e) => setFilter({ ...filter, tag: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">{t("admin.allOption")}</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400">{t("admin.videoMode")}</label>
            <select
              value={filter.videoMode}
              onChange={(e) =>
                setFilter({ ...filter, videoMode: e.target.value as typeof filter.videoMode })
              }
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">{t("admin.allOption")}</option>
              <option value="hls">{t("admin.videoModeHls")}</option>
              <option value="mp4">{t("admin.videoModeMp4")}</option>
              <option value="mixed">{t("admin.videoModeMixed")}</option>
              <option value="processing">{t("admin.videoModeProcessing")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400">{t("admin.labelListedShort")}</label>
            <select
              value={filter.listed}
              onChange={(e) =>
                setFilter({ ...filter, listed: e.target.value as typeof filter.listed })
              }
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">{t("admin.allOption")}</option>
              <option value="yes">{t("admin.yes")}</option>
              <option value="no">{t("admin.no")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400">{t("admin.labelTimeSort")}</label>
            <select
              value={`${filter.sortBy}-${filter.sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split("-") as ["createdAt" | "completedAt" | "listedAt", "asc" | "desc"];
                setFilter({ ...filter, sortBy: by, sortOrder: order });
              }}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="createdAt-desc">{t("admin.sortCreatedDesc")}</option>
              <option value="createdAt-asc">{t("admin.sortCreatedAsc")}</option>
              <option value="completedAt-desc">{t("admin.sortCompletedDesc")}</option>
              <option value="completedAt-asc">{t("admin.sortCompletedAsc")}</option>
              <option value="listedAt-desc">{t("admin.sortListedDesc")}</option>
              <option value="listedAt-asc">{t("admin.sortListedAsc")}</option>
            </select>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
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
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
            <button
              type="button"
              disabled={batchHlsRunning || hotHlsRunning}
              onClick={runBatchHlsOnFiltered}
              className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {batchHlsRunning
                ? t("admin.hlsBatchRunning")
                : t("admin.hlsBatchRunFiltered", { count: filtered.length })}
            </button>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/40 px-2 py-1.5">
              <span className="text-xs text-zinc-400">{t("admin.hlsFirstNEpisodes")}</span>
              <input
                type="number"
                min={0}
                value={firstNEpisodesPerSeries}
                onChange={(e) =>
                  setFirstNEpisodesPerSeries(Math.max(0, Number(e.target.value || 0)))
                }
                className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
              />
              <span className="text-[11px] text-zinc-500">{t("admin.hlsFirstNEpisodesHint")}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/40 px-2 py-1.5">
              <span className="text-xs text-zinc-400">{t("admin.hlsHotMinViews")}</span>
              <input
                type="number"
                min={0}
                value={hotMinViews}
                onChange={(e) => setHotMinViews(Math.max(0, Number(e.target.value || 0)))}
                className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
              />
              <span className="text-xs text-zinc-400">{t("admin.hlsHotMaxSeries")}</span>
              <input
                type="number"
                min={1}
                value={hotMaxSeries}
                onChange={(e) => setHotMaxSeries(Math.max(1, Number(e.target.value || 1)))}
                className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
              />
              <button
                type="button"
                disabled={batchHlsRunning || hotHlsRunning}
                onClick={runHotHls}
                className="rounded-md bg-fuchsia-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-50"
              >
                {hotHlsRunning ? t("admin.hlsHotRunning") : t("admin.hlsHotRun")}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/60">
        <div className="max-h-[calc(100vh-320px)] overflow-auto">
          {loading ? (
            <div className="py-12 text-center text-zinc-500">{t("admin.tableLoading")}</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">{t("admin.noDramasYetTable")}</div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[1000px] border-collapse">
                <thead className="sticky top-0 z-10 border-b border-zinc-700/80 bg-zinc-900/95 backdrop-blur">
                  <tr className="text-left text-xs text-zinc-400">
                    <th className="px-3 py-2 font-semibold">{t("admin.colTaskName")}</th>
                    <th className="px-3 py-2 font-semibold">{t("admin.colDramaId")}</th>
                    <th className="px-2 py-2 font-semibold">{t("admin.colCoverShort")}</th>
                    <th className="px-3 py-2 font-semibold">{t("admin.colDramaTitle")}</th>
                    <th className="px-3 py-2 font-semibold">{t("admin.colOriginalName")}</th>
                    <th className="px-3 py-2 font-semibold">{t("admin.labelTypeShort")}</th>
                    <th className="px-3 py-2 font-semibold">{t("admin.tags")}</th>
                    <th className="px-2 py-2 font-semibold">{t("admin.videoMode")}</th>
                    <th className="px-3 py-2 font-semibold">{t("admin.colDescShort")}</th>
                    <th className="px-2 py-2 font-semibold">{t("admin.colEpisodesCount")}</th>
                    <th className="px-2 py-2 font-semibold">{t("admin.colPaywallShort")}</th>
                    <th className="px-2 py-2 font-semibold">{t("admin.colListedShort")}</th>
                    <th className="px-2 py-2 font-semibold">{t("admin.colStatusShort")}</th>
                    <th className="px-3 py-2 font-semibold">{t("admin.colCreated")}</th>
                    <th className="px-3 py-2 font-semibold">{t("admin.colCompleted")}</th>
                    <th className="px-3 py-2 font-semibold">{t("admin.colListedTime")}</th>
                    <th className="px-3 py-2 font-semibold">{t("admin.colVideos")}</th>
                    <th className="px-3 py-2 font-semibold">{t("admin.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40"
                    >
                      <td className="min-w-[180px] px-3 py-2 text-sm text-zinc-200">
                        <span className="whitespace-nowrap" title={taskLabel(s)}>
                          {taskLabel(s)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-sm font-mono text-zinc-200">
                        {s.dramaId ?? "—"}
                      </td>
                      <td className="px-2 py-2">
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
                            className="aspect-[3/4] h-12 w-10 rounded object-cover hover:ring-2 hover:ring-brand/50"
                            loading="lazy"
                          />
                        </a>
                      </td>
                      <td className="min-w-[160px] px-3 py-2 text-sm text-zinc-200">
                        <span className="whitespace-nowrap" title={s.title}>
                          {s.title}
                        </span>
                      </td>
                      <td className="min-w-[120px] px-3 py-2 text-sm text-zinc-300">
                        <span className="whitespace-nowrap" title={s.originalName ?? ""}>
                          {s.originalName ?? "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-zinc-300">
                        {s.localOrTranslated === "local"
                          ? t("admin.localDrama")
                          : s.localOrTranslated === "translated"
                            ? t("admin.translatedDrama")
                            : "—"}
                      </td>
                      <td className="min-w-[80px] px-3 py-2 text-sm text-zinc-300">
                        <span className="whitespace-nowrap" title={(s.tags ?? []).join("、")}>
                          {(s.tags ?? []).join("、") || "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-300">
                        {(() => {
                          const mode = getSeriesVideoMode(s);
                          if (mode === "hls") return t("admin.videoModeHls");
                          if (mode === "mp4") return t("admin.videoModeMp4");
                          if (mode === "processing") return t("admin.videoModeProcessing");
                          return t("admin.videoModeMixed");
                        })()}
                      </td>
                      <td className="w-36 px-3 py-2 text-xs text-zinc-400">
                        <span className="line-clamp-2 block" title={s.description ?? ""}>
                          {s.description ?? "—"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-sm text-zinc-200">
                        {s.episodes?.length ?? 0}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-300">
                        {t("admin.lockFromEp", { n: s.lockStartIndex ?? 4 })}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-300">
                        {s.listed !== false ? t("admin.yes") : t("admin.no")}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-300">
                        {s.taskStatus === "completed"
                          ? t("admin.taskDone")
                          : s.taskStatus === "incomplete"
                            ? t("admin.taskPending")
                            : t("admin.taskDone")}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-[11px] text-zinc-400">
                        {formatTs(s.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-[11px] text-zinc-400">
                        {formatTs(s.completedAt)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-[11px] text-zinc-400">
                        {formatTs(s.listedAt)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {(s.episodes ?? []).slice(0, 3).map((e) => (
                            <a
                              key={e.id}
                              href={e.videoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-blue-400 hover:underline"
                            >
                              {t("admin.epLinkLabel", { n: e.index })}
                            </a>
                          ))}
                          {(s.episodes?.length ?? 0) > 3 && (
                            <span className="text-[11px] text-zinc-500">
                              +{s.episodes!.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditTarget(s)}
                            className="rounded-lg bg-blue-600/20 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/30"
                          >
                            {t("admin.edit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(s)}
                            className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                          >
                            {t("admin.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <DramaEditDrawer
        open={!!editTarget}
        series={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={handleEditSaved}
        onSeriesUpdated={(s) => {
          setSeries((prev) => prev.map((x) => (x.id === s.id ? s : x)));
          setEditTarget(s);
        }}
      />
    </main>
  );
}
