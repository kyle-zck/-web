"use client";

import Image from "next/image";
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

/** 单个 episode 的编辑抽屉 */
interface EpisodeEditDrawerProps {
  open: boolean;
  series: Series;
  episode: Episode;
  onClose: () => void;
  onSaved: (s: Series) => void;
}

function EpisodeEditDrawer({ open, series, episode, onClose, onSaved }: EpisodeEditDrawerProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    episodeTitle: "",
    episodeIndex: 1,
    seriesTitle: "",
    coverUrl: ""
  });
  const [coverImgError, setCoverImgError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        episodeTitle: episode.title,
        episodeIndex: episode.index,
        seriesTitle: series.title,
        coverUrl: series.cover ?? ""
      });
      setCoverImgError(false);
    }
  }, [open, episode, series]);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      showToast(t("common.admin.toastCoverFormat"));
      return;
    }

    let webpBlob: Blob;
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      const img = await createImageBitmap(file);
      const maxDim = 1200;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      webpBlob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))), "image/webp", 0.75)
      );
    } catch {
      showToast(t("common.admin.toastCoverUploadFail"), "error");
      return;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120);
    setUploadingCover(true);
    try {
      const { json } = await fetchAdminJson<{ ok?: boolean; key?: string; uploadUrl?: string; publicUrl?: string; errorKey?: string; error?: string }>(
        "/admin/api/upload/cover/presign",
        { method: "POST", body: JSON.stringify({ fileName: safeName }), headers: { "Content-Type": "application/json" } },
        30000
      );
      if (!json?.ok || !json.uploadUrl) {
        showToast(translateAdminApiError(json as { ok?: boolean; errorKey?: string; error?: string }, t, "admin.toastCoverUploadFail"), "error");
        return;
      }

      const uploadUrl = json.uploadUrl as string;
      const xhr = new XMLHttpRequest();
      const done = new Promise<void>((resolve, reject) => {
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", "image/webp");
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`HTTP ${xhr.status}`)));
        xhr.onerror = () => reject(new Error("Network error"));
        xhr.ontimeout = () => reject(new Error("Upload timed out"));
      });
      const timer = globalThis.setTimeout(() => xhr.abort(), 60000);
      xhr.send(webpBlob);
      await done;
      globalThis.clearTimeout(timer);

      const coverUrl = json.publicUrl ?? uploadUrl.split("?")[0];
      setForm((f) => ({ ...f, coverUrl }));
      setCoverImgError(false);
    } catch {
      showToast(t("common.admin.toastCoverUploadFail"), "error");
    } finally {
      setUploadingCover(false);
    }
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!form.episodeTitle.trim()) {
      showToast(t("common.admin.toastEpisodeTitleEmpty"));
      return;
    }
    if (form.episodeIndex < 1) {
      showToast(t("common.admin.toastEpisodeIndexInvalid"));
      return;
    }

    setSaving(true);
    try {
      // 1. 更新 episode 的 title
      const { res: epRes, json: epJson } = await fetchAdminJson<{ ok?: boolean; series?: Series }>(
        `/admin/api/series/${series.id}/episodes/${episode.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: form.episodeTitle.trim() })
        },
        15000
      );

      // 2. 更新 series 的 title 和 cover
      const patchSeries: Record<string, unknown> = {};
      if (form.seriesTitle.trim() && form.seriesTitle.trim() !== series.title) {
        patchSeries.title = form.seriesTitle.trim();
      }
      if (form.coverUrl && form.coverUrl !== series.cover) {
        patchSeries.cover = form.coverUrl;
        patchSeries.poster = form.coverUrl;
      }

      let updatedSeries = epJson?.series;
      if (Object.keys(patchSeries).length > 0) {
        const { res: sRes, json: sJson } = await fetchAdminJson<{ ok?: boolean; series?: Series }>(
          `/admin/api/series/${series.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patchSeries)
          },
          15000
        );
        if (sRes.ok && sJson?.ok && sJson.series) {
          updatedSeries = sJson.series;
        }
      }

      if (updatedSeries) {
        showToast(t("common.admin.saveSuccess"), "success");
        onSaved(updatedSeries);
        onClose();
      } else {
        showToast(translateAdminApiError(epJson as { ok?: boolean; errorKey?: string; error?: string }, t, "admin.saveFailed"), "error");
      }
    } catch {
      showToast(t("common.admin.networkErrorShort"));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800/80 p-4">
          <h2 className="text-lg font-bold text-zinc-100">{t("common.admin.editEpisodeTitle")}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Episode 字段 */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("common.admin.episodeInfo")}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.editFieldEpisodeTitle")}</label>
                <input
                  type="text"
                  value={form.episodeTitle}
                  onChange={(e) => setForm((f) => ({ ...f, episodeTitle: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100"
                  placeholder={t("common.admin.episodeTitlePlaceholder")}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.editFieldEpisodeIndex")}</label>
                <input
                  type="number"
                  min={1}
                  value={form.episodeIndex}
                  onChange={(e) => setForm((f) => ({ ...f, episodeIndex: parseInt(e.target.value || "1", 10) }))}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100"
                />
                <p className="mt-1 text-[11px] text-zinc-500">{t("common.admin.episodeIndexHint")}</p>
              </div>
            </div>
          </section>

          {/* Series 字段 */}
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">{t("common.admin.dramaInfo")}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.editFieldSeriesTitle")}</label>
                <input
                  type="text"
                  value={form.seriesTitle}
                  onChange={(e) => setForm((f) => ({ ...f, seriesTitle: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.editFieldCover")}</label>
                <div className="mt-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-700/60 disabled:opacity-50">
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp"
                      onChange={handleCoverUpload}
                      disabled={uploadingCover}
                      className="hidden"
                    />
                    {uploadingCover ? t("common.admin.uploading") : t("common.admin.clickUpload")}
                  </label>
                  {form.coverUrl && (
                    <div className="mt-2">
                      {coverImgError ? (
                        <div className="flex flex-col items-center gap-2 rounded-lg border border-red-500/30 bg-red-950/20 p-4">
                          <div className="text-xs text-red-400">{t("common.admin.coverLoadFailed")}</div>
                          <button type="button" onClick={() => setCoverImgError(false)} className="rounded-md border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/15">
                            {t("common.admin.coverRetry")}
                          </button>
                        </div>
                      ) : (
                        <div className="relative h-40 w-28 overflow-hidden rounded-lg border border-zinc-700">
                          <Image
                            unoptimized
                            src={form.coverUrl}
                            alt={form.seriesTitle || series.title}
                            fill
                            className="object-cover"
                            onError={() => setCoverImgError(true)}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
        <div className="border-t border-zinc-800/80 p-4">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {saving ? t("common.admin.savingShort") : t("common.admin.saveBtn")}
          </button>
        </div>
      </div>
    </>
  );
}

export default function AdminEpisodeManagementPage() {
  const { t } = useTranslation();
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [draft, setDraft] = useState({ dramaId: "", originalName: "", title: "" });
  const [applied, setApplied] = useState({ dramaId: "", originalName: "", title: "" });
  const [refreshingEpisodeId, setRefreshingEpisodeId] = useState<string | null>(null);
  const [batchRefreshing, setBatchRefreshing] = useState(false);
  const [checkingEpisodeId, setCheckingEpisodeId] = useState<string | null>(null);
  const [batchChecking, setBatchChecking] = useState(false);
  const [selectedEpisodeKeys, setSelectedEpisodeKeys] = useState<Set<string>>(new Set());
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
  const [editTarget, setEditTarget] = useState<{ series: Series; episode: Episode } | null>(null);

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

  const episodeKey = (s: Series, e: Episode) => `${s.id}::${e.id}`;

  const deleteEpisode = async (s: Series, e: Episode) => {
    const ok = confirm(t("common.admin.confirmDeleteEpisode", { title: s.title, n: e.index }));
    if (!ok) return;
    try {
      const { res, json } = await fetchAdminJson<{ ok?: boolean; errorKey?: string }>(
        `/admin/api/series/${s.id}/episodes/${e.id}`,
        { method: "DELETE" },
        10000
      );
      if (!res.ok || !json?.ok) {
        showToast(translateAdminApiError(json, t, "admin.episodeDeleteFailed"), "error");
        return;
      }
      setSelectedEpisodeKeys((prev) => {
        const next = new Set(prev);
        next.delete(episodeKey(s, e));
        return next;
      });
      showToast(t("common.admin.episodeDeleted"), "success");
      await load();
    } catch {
      showToast(t("common.admin.networkErrorShort"));
    }
  };

  const toggleEpisodeRow = (key: string, checked: boolean) => {
    setSelectedEpisodeKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const toggleAllRows = (checked: boolean) => {
    setSelectedEpisodeKeys((prev) => {
      const next = new Set(prev);
      if (checked) rows.forEach(({ series: s, episode: e }) => next.add(episodeKey(s, e)));
      else rows.forEach(({ series: s, episode: e }) => next.delete(episodeKey(s, e)));
      return next;
    });
  };

  const batchDeleteEpisodes = async () => {
    const selectedRows = rows.filter(({ series: s, episode: e }) => selectedEpisodeKeys.has(episodeKey(s, e)));
    if (selectedRows.length === 0) {
      showToast(t("common.admin.noEpisodeRows"), "info");
      return;
    }
    if (!confirm(t("common.admin.confirmDeleteSelectedEpisodes", { count: selectedRows.length }))) return;

    let okCount = 0;
    for (const { series: s, episode: e } of selectedRows) {
      try {
        const { res, json } = await fetchAdminJson<{ ok?: boolean }>(
          `/admin/api/series/${s.id}/episodes/${e.id}`,
          { method: "DELETE" },
          10000
        );
        if (res.ok && json?.ok) okCount += 1;
      } catch {
        // continue
      }
    }

    if (okCount > 0) {
      showToast(t("common.admin.batchDeleteEpisodesDone", { ok: okCount, total: selectedRows.length }), "success");
      setSelectedEpisodeKeys((prev) => {
        const next = new Set(prev);
        selectedRows.forEach(({ series: s, episode: e }) => next.delete(episodeKey(s, e)));
        return next;
      });
      await load();
    } else {
      showToast(t("common.admin.episodeDeleteFailed"), "error");
    }
  };

  const refreshEpisodeStatus = async (s: Series, e: Episode) => {
    if (!e.videoStreamId) {
      showToast(t("common.admin.videoStatusNoStreamId"), "info");
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
        showToast(t("common.admin.videoStatusRefreshFailed"));
        return;
      }
      await load();
      showToast(t("common.admin.videoStatusRefreshed"), "success");
    } catch {
      showToast(t("common.admin.networkErrorShort"));
    } finally {
      setRefreshingEpisodeId(null);
    }
  };

  const refreshProcessingEpisodes = async () => {
    if (processingRows.length === 0) {
      showToast(t("common.admin.videoStatusNoProcessing"), "info");
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
        t("common.admin.videoStatusBatchRefreshed", {
          ok: okCount,
          total: processingRows.length
        }),
        "success"
      );
    } catch {
      showToast(t("common.admin.videoStatusRefreshFailed"));
    } finally {
      setBatchRefreshing(false);
    }
  };

  const checkEpisodeResources = async (s: Series, e: Episode) => {
    setCheckingEpisodeId(e.id);
    try {
      const { res, json } = await fetchAdminJson<{
        ok?: boolean;
        results?: Array<{
          kind: "cover" | "videoUrl" | "videoPlaybackUrl";
          ok: boolean;
          status: number;
        }>;
        errorKey?: string;
      }>(
        "/admin/api/video/check-url",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [
              { kind: "cover", url: s.cover },
              { kind: "videoUrl", url: e.videoUrl },
              { kind: "videoPlaybackUrl", url: e.videoPlaybackUrl || e.videoUrl }
            ]
          })
        },
        10000
      );
      if (!res.ok || !json?.ok || !Array.isArray(json.results)) {
        showToast(translateAdminApiError(json, t, "admin.videoHealthCheckFailed"), "error");
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
      showToast(t("common.admin.videoHealthChecked"), "success");
    } catch {
      showToast(t("common.admin.networkErrorShort"));
    } finally {
      setCheckingEpisodeId(null);
    }
  };

  const checkVisibleResources = async () => {
    if (rows.length === 0) {
      showToast(t("common.admin.noEpisodeRows"), "info");
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
              const { res, json } = await fetchAdminJson<{
                ok?: boolean;
                results?: Array<{
                  kind: "cover" | "videoUrl" | "videoPlaybackUrl";
                  ok: boolean;
                  status: number;
                }>;
              }>(
                "/admin/api/video/check-url",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    items: [
                      { kind: "cover", url: s.cover },
                      { kind: "videoUrl", url: e.videoUrl },
                      { kind: "videoPlaybackUrl", url: e.videoPlaybackUrl || e.videoUrl }
                    ]
                  })
                },
                10000
              );
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
      showToast(t("common.admin.videoHealthBatchChecked", { ok: okCount, total: rows.length }), "success");
    } catch {
      showToast(t("common.admin.videoHealthCheckFailed"));
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
    if (status === "ready") return t("common.admin.videoStatusReady");
    if (status === "failed") return t("common.admin.videoStatusFailed");
    return t("common.admin.videoStatusProcessing");
  };

  return (
    <main>
      <p className="text-xs font-medium text-zinc-500">{t("common.admin.dramaResourceManagement")}</p>
      <h4 className="mt-1 text-base font-bold text-zinc-100">{t("common.admin.episodeManagement")}</h4>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
        {t("common.admin.episodeManagementIntro")}
      </p>

      <section className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400">
            {t("common.admin.dramaIdFilter")}
          </label>
          <input
            type="text"
            value={draft.dramaId}
            onChange={(e) => setDraft((d) => ({ ...d, dramaId: e.target.value }))}
            placeholder={t("common.admin.dramaIdFilterPh")}
            className="mt-1 w-40 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-400">
            {t("common.admin.originalNameFilter")}
          </label>
          <input
            type="text"
            value={draft.originalName}
            onChange={(e) => setDraft((d) => ({ ...d, originalName: e.target.value }))}
            placeholder={t("common.admin.originalNameFilterPh")}
            className="mt-1 w-44 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-400">
            {t("common.admin.dramaTitleFilter")}
          </label>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder={t("common.admin.dramaTitleFilterPh")}
            className="mt-1 w-44 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={batchDeleteEpisodes}
            disabled={rows.filter(({ series: s, episode: e }) => selectedEpisodeKeys.has(episodeKey(s, e))).length === 0}
            className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
          >
            {t("common.admin.batchDeleteWithCount", {
              count: rows.filter(({ series: s, episode: e }) => selectedEpisodeKeys.has(episodeKey(s, e))).length
            })}
          </button>
          <button
            type="button"
            disabled={batchRefreshing || batchChecking}
            onClick={checkVisibleResources}
            className="rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-300 hover:bg-cyan-500/20 disabled:opacity-50"
          >
            {batchChecking
              ? t("common.admin.videoHealthBatchChecking")
              : t("common.admin.videoHealthBatchCheck", { count: rows.length })}
          </button>
          <button
            type="button"
            disabled={batchRefreshing}
            onClick={refreshProcessingEpisodes}
            className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {batchRefreshing
              ? t("common.admin.videoStatusBatchRefreshing")
              : t("common.admin.videoStatusBatchRefresh", { count: processingRows.length })}
          </button>
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
        <div className="max-h-[calc(100vh-340px)] overflow-auto">
          {loading ? (
            <div className="py-12 text-center text-zinc-500">{t("common.admin.tableLoading")}</div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[1180px] border-collapse">
                <thead className="sticky top-0 z-10 border-b border-zinc-700/80 bg-zinc-900/95 backdrop-blur">
                  <tr className="text-left text-xs text-zinc-400">
                    <th className="px-2 py-2 font-semibold">
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && rows.every(({ series: s, episode: e }) => selectedEpisodeKeys.has(episodeKey(s, e)))}
                        onChange={(e) => toggleAllRows(e.target.checked)}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("common.admin.episodeColDramaId")}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("common.admin.episodeColIndex")}</th>
                    <th className="min-w-[100px] px-3 py-2 font-semibold">{t("common.admin.colOriginalName")}</th>
                    <th className="min-w-[100px] px-3 py-2 font-semibold">{t("common.admin.colDramaTitle")}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("common.admin.episodeColCover")}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("common.admin.episodeColStreamStatus")}</th>
                    <th className="min-w-[120px] px-3 py-2 font-semibold">{t("common.admin.episodeColLocalVideo")}</th>
                    <th className="min-w-[120px] px-3 py-2 font-semibold">{t("common.admin.episodeColSiteLink")}</th>
                    <th className="whitespace-nowrap px-3 py-2 font-semibold">{t("common.admin.action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-sm text-zinc-500">
                        {t("common.admin.noEpisodeRows")}
                      </td>
                    </tr>
                  ) : (
                    rows.map(({ series: s, episode: e }) => (
                      <tr
                        key={`${s.id}-${e.id}`}
                        className="border-b border-zinc-800/60 last:border-0 hover:bg-zinc-900/40"
                      >
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            checked={selectedEpisodeKeys.has(episodeKey(s, e))}
                            onChange={(ev) => toggleEpisodeRow(episodeKey(s, e), ev.target.checked)}
                            aria-label={`Select episode ${e.index}`}
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-sm font-mono text-zinc-200">
                          {s.dramaId ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-sm text-zinc-200">
                          <div className="whitespace-nowrap">{t("common.admin.episodeRowLabel", { n: e.index })}</div>
                          {e.sourceFileName ? (
                            <div
                              className="mt-0.5 max-w-[200px] truncate text-[11px] text-zinc-500"
                              title={e.sourceFileName}
                            >
                              {t("common.admin.episodeFileName", { name: e.sourceFileName })}
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
                                ? t("common.admin.videoStatusRefreshing")
                                : t("common.admin.videoStatusRefresh")}
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
                                ? t("common.admin.fileLinkBlockedHint")
                                : e.sourceFileName ?? t("common.admin.localResourceFallback")
                            }
                          >
                            {t("common.admin.openLocalResource")}
                          </a>
                          {playableStreamUrl(e) ? (
                            <a
                              href={playableStreamUrl(e)!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 block text-xs text-emerald-400/90 hover:underline"
                              title={t("common.admin.episodeStreamUrlTitle")}
                            >
                              {t("common.admin.openStreamUrl")}
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
                              {t("common.admin.frontendPlayPage")}
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
                                ? t("common.admin.videoHealthChecking")
                                : t("common.admin.videoHealthCheck")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditTarget({ series: s, episode: e })}
                              className="rounded-lg bg-blue-600/20 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/30"
                            >
                              {t("common.admin.edit")}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteEpisode(s, e)}
                              className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/15"
                            >
                              {t("common.admin.delete")}
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

      <EpisodeEditDrawer
        open={!!editTarget}
        series={editTarget!.series}
        episode={editTarget!.episode}
        onClose={() => setEditTarget(null)}
        onSaved={(s) => {
          setSeries((prev) => prev.map((x) => (x.id === s.id ? s : x)));
        }}
      />
    </main>
  );
}
