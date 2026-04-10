"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Series } from "@/constants/mock-data";
import { showToast } from "@/components/ui/toast";
import { DramaEditDrawer } from "@/components/admin/drama-edit-drawer";
import { fetchAdminJson } from "@/lib/admin/fetch-admin-json";
import { getSeriesVideoMode } from "@/lib/video/series-video-mode";
import { translateAdminApiError } from "@/lib/admin/api-error";
import { cn } from "@/lib/utils";

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
    (s: Series) => buildTaskName(s, t("common.admin.unnamed"), formatTs),
    [formatTs, t]
  );
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Series | null>(null);
  const [batchHlsRunning, setBatchHlsRunning] = useState(false);
  const [hotHlsRunning, setHotHlsRunning] = useState(false);
  const [hotMinViews, setHotMinViews] = useState(500);
  const [hotMaxSeries, setHotMaxSeries] = useState(20);
  const [firstNEpisodesPerSeries, setFirstNEpisodesPerSeries] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { res, json } = await fetchAdminJson<{ ok?: boolean; series?: Series[]; errorKey?: string }>(
        "/admin/api/series",
        undefined,
        10000
      );
      if (res.ok && json?.ok && Array.isArray(json.series)) setSeries(json.series);
      else {
        setSeries([]);
        setLoadError(translateAdminApiError(json, t));
      }
    } catch {
      setSeries([]);
      setLoadError(String(t("common.admin.networkError")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

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
    showToast(t("common.admin.toastResetFilters"), "info");
  };

  const handleQuery = () => {
    setAppliedFilter(filter);
    showToast(t("common.admin.toastQueryFilters"), "info");
  };

  const handleDelete = async (s: Series) => {
    if (!confirm(t("common.admin.confirmDeleteDramaFull", { title: s.title }))) return;
    try {
      const { res, json } = await fetchAdminJson<{ ok?: boolean; errorKey?: string }>(
        `/admin/api/series/${s.id}`,
        { method: "DELETE" },
        10000
      );
      if (res.ok && json?.ok) {
        showToast(t("common.admin.deleteSuccess"), "success");
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(s.id);
          return next;
        });
        load();
      } else {
        showToast(translateAdminApiError(json, t, "admin.deleteFailed"), "error");
      }
    } catch {
      showToast(t("common.admin.networkErrorShort"));
    }
  };

  const toggleRowSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAllFiltered = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) filtered.forEach((s) => next.add(s.id));
      else filtered.forEach((s) => next.delete(s.id));
      return next;
    });
  };

  const handleBatchDelete = async () => {
    const ids = filtered.map((s) => s.id).filter((id) => selectedIds.has(id));
    if (ids.length === 0) {
      showToast(t("common.admin.noDataShort"), "info");
      return;
    }
    if (!confirm(t("common.admin.confirmDeleteSelectedDramas", { count: ids.length }))) return;

    let okCount = 0;
    for (const id of ids) {
      try {
        const { res, json } = await fetchAdminJson<{ ok?: boolean; errorKey?: string }>(
          `/admin/api/series/${id}`,
          { method: "DELETE" },
          10000
        );
        if (res.ok && json?.ok) okCount += 1;
      } catch {
        // continue
      }
    }

    if (okCount > 0) {
      showToast(t("common.admin.batchDeleteSuccess", { ok: okCount, total: ids.length }), "success");
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      await load();
    } else {
      showToast(t("common.admin.deleteFailed"), "error");
    }
  };

  const handleEditSaved = () => {
    load();
    setEditTarget(null);
  };

  const runBatchHlsOnFiltered = async () => {
    const ids = filtered.map((s) => s.id);
    if (ids.length === 0) {
      showToast(t("common.admin.noDramasYetTable"), "info");
      return;
    }
    setBatchHlsRunning(true);
    try {
      const { res, json } = await fetchAdminJson<{
        ok?: boolean;
        okCount?: number;
        totalJobs?: number;
        errorKey?: string;
      }>(
        "/admin/api/video/transcode-hls",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "manual",
            seriesIds: ids,
            firstNEpisodesPerSeries
          })
        },
        10000
      );
      if (!res.ok || !json?.ok) {
        showToast(translateAdminApiError(json, t, "admin.hlsBatchRunFailed"), "error");
        return;
      }
      showToast(
        t("common.admin.hlsBatchRunDone", {
          ok: json.okCount ?? 0,
          total: json.totalJobs ?? 0
        }),
        "success"
      );
      await load();
    } catch {
      showToast(t("common.admin.networkErrorShort"));
    } finally {
      setBatchHlsRunning(false);
    }
  };

  const runHotHls = async () => {
    setHotHlsRunning(true);
    try {
      const { res, json } = await fetchAdminJson<{
        ok?: boolean;
        okCount?: number;
        totalJobs?: number;
        errorKey?: string;
      }>(
        "/admin/api/video/transcode-hls",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "hot",
            minViews: hotMinViews,
            maxSeries: hotMaxSeries,
            firstNEpisodesPerSeries
          })
        },
        10000
      );
      if (!res.ok || !json?.ok) {
        showToast(translateAdminApiError(json, t, "admin.hlsHotRunFailed"), "error");
        return;
      }
      showToast(
        t("common.admin.hlsHotRunDone", {
          ok: json.okCount ?? 0,
          total: json.totalJobs ?? 0
        }),
        "success"
      );
      await load();
    } catch {
      showToast(t("common.admin.networkErrorShort"));
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
        {t("common.admin.dramaDetail")}
      </h1>
      <p className="mt-1 text-xs text-zinc-400">{t("common.admin.dramaDetailIntro")}</p>

      <section className="mt-6 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.labelTaskName")}</label>
            <input
              type="text"
              value={filter.taskName}
              onChange={(e) => setFilter({ ...filter, taskName: e.target.value })}
              placeholder={t("common.admin.phFuzzySearch")}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.labelDramaIdFilter")}</label>
            <input
              type="text"
              value={filter.dramaId}
              onChange={(e) => setFilter({ ...filter, dramaId: e.target.value })}
              placeholder={t("common.admin.phNumberSearch")}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.labelDramaTitleFilter")}</label>
            <input
              type="text"
              value={filter.title}
              onChange={(e) => setFilter({ ...filter, title: e.target.value })}
              placeholder={t("common.admin.phFuzzySearch")}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.labelTypeShort")}</label>
            <select
              value={filter.localOrTranslated}
              onChange={(e) =>
                setFilter({ ...filter, localOrTranslated: e.target.value as typeof filter.localOrTranslated })
              }
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">{t("common.admin.allOption")}</option>
              <option value="local">{t("common.admin.localDrama")}</option>
              <option value="translated">{t("common.admin.translatedDrama")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.tags")}</label>
            <select
              value={filter.tag}
              onChange={(e) => setFilter({ ...filter, tag: e.target.value })}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">{t("common.admin.allOption")}</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.videoMode")}</label>
            <select
              value={filter.videoMode}
              onChange={(e) =>
                setFilter({ ...filter, videoMode: e.target.value as typeof filter.videoMode })
              }
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">{t("common.admin.allOption")}</option>
              <option value="hls">{t("common.admin.videoModeHls")}</option>
              <option value="mp4">{t("common.admin.videoModeMp4")}</option>
              <option value="mixed">{t("common.admin.videoModeMixed")}</option>
              <option value="processing">{t("common.admin.videoModeProcessing")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.labelListedShort")}</label>
            <select
              value={filter.listed}
              onChange={(e) =>
                setFilter({ ...filter, listed: e.target.value as typeof filter.listed })
              }
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="">{t("common.admin.allOption")}</option>
              <option value="yes">{t("common.admin.yes")}</option>
              <option value="no">{t("common.admin.no")}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.labelTimeSort")}</label>
            <select
              value={`${filter.sortBy}-${filter.sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split("-") as ["createdAt" | "completedAt" | "listedAt", "asc" | "desc"];
                setFilter({ ...filter, sortBy: by, sortOrder: order });
              }}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="createdAt-desc">{t("common.admin.sortCreatedDesc")}</option>
              <option value="createdAt-asc">{t("common.admin.sortCreatedAsc")}</option>
              <option value="completedAt-desc">{t("common.admin.sortCompletedDesc")}</option>
              <option value="completedAt-asc">{t("common.admin.sortCompletedAsc")}</option>
              <option value="listedAt-desc">{t("common.admin.sortListedDesc")}</option>
              <option value="listedAt-asc">{t("common.admin.sortListedAsc")}</option>
            </select>
          </div>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
            <button
              type="button"
              onClick={handleReset}
              className="rounded-lg border border-zinc-600 bg-zinc-800/60 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-700/60"
            >
              {t("common.admin.reset")}
            </button>
            <button
              type="button"
              onClick={handleQuery}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              {t("common.admin.query")}
            </button>
            <button
              type="button"
              onClick={handleBatchDelete}
              disabled={filtered.filter((s) => selectedIds.has(s.id)).length === 0}
              className="rounded-lg border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
            >
              {t("common.admin.batchDeleteWithCount", { count: filtered.filter((s) => selectedIds.has(s.id)).length })}
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
                ? t("common.admin.hlsBatchRunning")
                : t("common.admin.hlsBatchRunFiltered", { count: filtered.length })}
            </button>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/40 px-2 py-1.5">
              <span className="text-xs text-zinc-400">{t("common.admin.hlsFirstNEpisodes")}</span>
              <input
                type="number"
                min={0}
                value={firstNEpisodesPerSeries}
                onChange={(e) =>
                  setFirstNEpisodesPerSeries(Math.max(0, Number(e.target.value || 0)))
                }
                className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
              />
              <span className="text-[11px] text-zinc-500">{t("common.admin.hlsFirstNEpisodesHint")}</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/40 px-2 py-1.5">
              <span className="text-xs text-zinc-400">{t("common.admin.hlsHotMinViews")}</span>
              <input
                type="number"
                min={0}
                value={hotMinViews}
                onChange={(e) => setHotMinViews(Math.max(0, Number(e.target.value || 0)))}
                className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
              />
              <span className="text-xs text-zinc-400">{t("common.admin.hlsHotMaxSeries")}</span>
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
                {hotHlsRunning ? t("common.admin.hlsHotRunning") : t("common.admin.hlsHotRun")}
              </button>
            </div>
          </div>
        </div>
      </section>

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

      <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950/60">
        <div className="max-h-[calc(100vh-320px)] overflow-auto">
          {loading ? (
            <div className="py-12 text-center text-zinc-500">{t("common.admin.tableLoading")}</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-zinc-500">{t("common.admin.noDramasYetTable")}</div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[1000px] border-collapse">
                <thead className="sticky top-0 z-10 border-b border-zinc-700/80 bg-zinc-900/95 backdrop-blur">
                  <tr className="text-left text-xs text-zinc-400">
                    <th className="px-2 py-2 font-semibold">
                      <input
                        type="checkbox"
                        checked={filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id))}
                        onChange={(e) => toggleAllFiltered(e.target.checked)}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="px-3 py-2 font-semibold">{t("common.admin.colTaskName")}</th>
                    <th className="px-3 py-2 font-semibold">{t("common.admin.colDramaId")}</th>
                    <th className="px-2 py-2 font-semibold">{t("common.admin.colCoverShort")}</th>
                    <th className="px-3 py-2 font-semibold">{t("common.admin.colDramaTitle")}</th>
                    <th className="px-3 py-2 font-semibold">{t("common.admin.colOriginalName")}</th>
                    <th className="px-3 py-2 font-semibold">{t("common.admin.labelTypeShort")}</th>
                    <th className="px-3 py-2 font-semibold">{t("common.admin.tags")}</th>
                    <th className="px-2 py-2 font-semibold">{t("common.admin.videoMode")}</th>
                    <th className="px-3 py-2 font-semibold">{t("common.admin.colDescShort")}</th>
                    <th className="px-2 py-2 font-semibold">{t("common.admin.colEpisodesCount")}</th>
                    <th className="px-2 py-2 font-semibold">{t("common.admin.colPaywallShort")}</th>
                    <th className="px-2 py-2 font-semibold">{t("common.admin.colListedShort")}</th>
                    <th className="px-2 py-2 font-semibold">{t("common.admin.colStatusShort")}</th>
                    <th className="px-3 py-2 font-semibold">{t("common.admin.colCreated")}</th>
                    <th className="px-3 py-2 font-semibold">{t("common.admin.colCompleted")}</th>
                    <th className="px-3 py-2 font-semibold">{t("common.admin.colListedTime")}</th>
                    <th className="px-3 py-2 font-semibold">{t("common.admin.colVideos")}</th>
                    <th className="px-3 py-2 font-semibold">{t("common.admin.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40"
                    >
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(s.id)}
                          onChange={(e) => toggleRowSelected(s.id, e.target.checked)}
                          aria-label={`Select ${s.title}`}
                        />
                      </td>
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
                          className="relative block w-10 shrink-0"
                          title={t("common.admin.clickViewCover")}
                        >
                          <Image
                            unoptimized
                            src={s.cover}
                            alt={s.title}
                            fill
                            className="object-cover"
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
                          ? t("common.admin.localDrama")
                          : s.localOrTranslated === "translated"
                            ? t("common.admin.translatedDrama")
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
                          if (mode === "hls") return t("common.admin.videoModeHls");
                          if (mode === "mp4") return t("common.admin.videoModeMp4");
                          if (mode === "processing") return t("common.admin.videoModeProcessing");
                          return t("common.admin.videoModeMixed");
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
                        {t("common.admin.lockFromEp", { n: s.lockStartIndex ?? 4 })}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-300">
                        {s.listed !== false ? t("common.admin.yes") : t("common.admin.no")}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-xs text-zinc-300">
                        {s.taskStatus === "completed"
                          ? t("common.admin.taskDone")
                          : s.taskStatus === "incomplete"
                            ? t("common.admin.taskPending")
                            : t("common.admin.taskDone")}
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
                          {(s.episodes ?? []).slice(0, 5).map((e) => (
                            <div key={e.id} className="flex items-center gap-1">
                              <span
                                title={e.videoStatus === "failed" ? t("common.admin.videoStatusFailed") : e.videoStatus === "ready" ? t("common.admin.videoStatusReady") : t("common.admin.videoStatusProcessing")}
                                className={cn(
                                  "inline-block h-2 w-2 shrink-0 rounded-full",
                                  e.videoStatus === "failed"
                                    ? "bg-red-500"
                                    : e.videoStatus === "ready"
                                      ? "bg-emerald-400"
                                      : "bg-amber-400"
                                )}
                              />
                              {e.videoUrl ? (
                                <a
                                  href={e.videoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[11px] text-blue-400 hover:underline"
                                >
                                  {t("common.admin.epLinkLabel", { n: e.index })}
                                </a>
                              ) : (
                                <span className="text-[11px] text-zinc-600">
                                  {t("common.admin.epLinkLabel", { n: e.index })}
                                </span>
                              )}
                            </div>
                          ))}
                          {(s.episodes?.length ?? 0) > 5 && (
                            <span className="text-[11px] text-zinc-500">
                              +{s.episodes!.length - 5}
                            </span>
                          )}
                        </div>
                        {((s.episodes ?? []).some((e) => e.videoStatus === "failed" || !e.videoUrl)) && (
                          <button
                            type="button"
                            onClick={() => setEditTarget(s)}
                            className="mt-1 flex items-center gap-1 rounded border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-300 hover:bg-red-500/20"
                          >
                            <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            {t("common.admin.reupload")}
                          </button>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setEditTarget(s)}
                            className="rounded-lg bg-blue-600/20 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/30"
                          >
                            {t("common.admin.edit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(s)}
                            className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                          >
                            {t("common.admin.delete")}
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
