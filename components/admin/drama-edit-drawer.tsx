"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Episode, Series } from "@/constants/mock-data";
import { showToast } from "@/components/ui/toast";
import { translateAdminApiError } from "@/lib/admin/api-error";
import { fetchAdminJson } from "@/lib/admin/fetch-admin-json";

/** 与上传页、标签目录一致：drama-tag-catalog */
interface CatalogTag {
  id: string;
  name: string;
}

interface DramaEditDrawerProps {
  open: boolean;
  series: Series | null;
  onClose: () => void;
  onSaved: () => void;
  /** 分集增删后返回最新剧目数据，用于列表与抽屉同步且不关闭 */
  onSeriesUpdated?: (s: Series) => void;
}

export function DramaEditDrawer({
  open,
  series,
  onClose,
  onSaved,
  onSeriesUpdated
}: DramaEditDrawerProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    title: "",
    originalName: "",
    localOrTranslated: "" as "" | "local" | "translated",
    description: "",
    tagIds: [] as string[],
    lockStartIndex: 1,
    coverUrl: "",
    listed: true
  });
  const [tags, setTags] = useState<CatalogTag[]>([]);
  const [saving, setSaving] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [bulkVideoUrls, setBulkVideoUrls] = useState("");
  const [deletingEpId, setDeletingEpId] = useState<string | null>(null);
  const [addingEpisode, setAddingEpisode] = useState(false);
  const [bulkAdding, setBulkAdding] = useState(false);
  const [refreshingEpId, setRefreshingEpId] = useState<string | null>(null);
  const [reuploadEpId, setReuploadEpId] = useState<string | null>(null);
  const [seriesHlsRunning, setSeriesHlsRunning] = useState(false);
  const [seriesHlsFirstN, setSeriesHlsFirstN] = useState(0);
  const [coverImgError, setCoverImgError] = useState(false);

  const statusLabel = (status?: Episode["videoStatus"]) => {
    if (status === "ready") return t("common.admin.videoStatusReady");
    if (status === "failed") return t("common.admin.videoStatusFailed");
    return t("common.admin.videoStatusProcessing");
  };

  const statusTone = (status?: Episode["videoStatus"]) => {
    if (status === "ready") return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40";
    if (status === "failed") return "bg-red-500/15 text-red-300 ring-red-500/40";
    return "bg-amber-500/15 text-amber-300 ring-amber-500/40";
  };

  useEffect(() => {
    fetchAdminJson<{ ok?: boolean; items?: CatalogTag[] }>("/admin/api/drama-tag-catalog")
      .then(({ res, json }) => {
        if (res.ok && json?.ok && Array.isArray(json.items)) setTags(json.items);
        else setTags([]);
      })
      .catch(() => setTags([]));
  }, []);

  useEffect(() => {
    if (series && tags.length > 0) {
      const tagIds = (series.tags ?? [])
        .map((tagName) => tags.find((x) => x.name === tagName)?.id)
        .filter((id): id is string => Boolean(id));
      setForm({
        title: series.title ?? "",
        originalName: series.originalName ?? "",
        localOrTranslated: series.localOrTranslated ?? "",
        description: series.description ?? "",
        tagIds,
        lockStartIndex: series.lockStartIndex ?? 4,
        coverUrl: series.cover ?? "",
        listed: series.listed !== false
      });
    } else if (series) {
      setForm({
        title: series.title ?? "",
        originalName: series.originalName ?? "",
        localOrTranslated: series.localOrTranslated ?? "",
        description: series.description ?? "",
        tagIds: [],
        lockStartIndex: series.lockStartIndex ?? 4,
        coverUrl: series.cover ?? "",
        listed: series.listed !== false
      });
      setCoverImgError(false);
    }
  }, [series, tags]);

  useEffect(() => {
    setNewVideoUrl("");
    setBulkVideoUrls("");
    setSeriesHlsFirstN(0);
    setCoverImgError(false);
  }, [series?.id]);

  const sampleVideoUrl = () =>
    process.env.NEXT_PUBLIC_SAMPLE_VIDEO_URL?.trim() ||
    "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

  const postAppendEpisode = async (
    payload: {
      videoUrl: string;
      sourceFileName?: string;
      localVideoUrl?: string;
      videoStreamId?: string;
      videoPlaybackUrl?: string;
      videoStatus?: "processing" | "ready" | "failed";
    },
    opts?: { silent?: boolean }
  ): Promise<boolean> => {
    if (!series) return false;
    const { res, json } = await fetchAdminJson<{
      ok?: boolean;
      series?: Series;
      error?: string;
      errorKey?: string;
    }>(`/admin/api/series/${series.id}/episodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok && json?.ok && json.series) {
      if (!opts?.silent) showToast(t("common.admin.episodeAddedToast"), "success");
      onSeriesUpdated?.(json.series);
      setNewVideoUrl("");
      return true;
    }
    if (!opts?.silent) showToast(translateAdminApiError(json, t, "admin.saveFailed"));
    return false;
  };

  const handleDeleteEpisode = async (ep: Episode) => {
    if (!series) return;
    const ok = confirm(
      t("common.admin.confirmDeleteEpisode", { title: series.title, n: ep.index })
    );
    if (!ok) return;
    setDeletingEpId(ep.id);
    try {
      const { res, json } = await fetchAdminJson<{
        ok?: boolean;
        series?: Series;
        error?: string;
        errorKey?: string;
      }>(`/admin/api/series/${series.id}/episodes/${ep.id}`, { method: "DELETE" });
      if (res.ok && json?.ok && json.series) {
        showToast(t("common.admin.episodeDeletedToast"), "success");
        onSeriesUpdated?.(json.series);
      } else {
        showToast(translateAdminApiError(json, t, "admin.saveFailed"));
      }
    } catch {
      showToast(t("common.admin.networkErrorShort"));
    } finally {
      setDeletingEpId(null);
    }
  };

  const handleAddEpisodeByUrl = async () => {
    if (!series) return;
    const url = newVideoUrl.trim();
    if (!url) {
      showToast(t("common.admin.apiErrEpisodeVideoUrlRequired"));
      return;
    }
    setAddingEpisode(true);
    try {
      await postAppendEpisode({ videoUrl: url });
    } finally {
      setAddingEpisode(false);
    }
  };

  const handleBulkAddEpisodesByUrl = async () => {
    if (!series) return;
    const lines = bulkVideoUrls
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      showToast(t("common.admin.bulkUrlEmpty"), "info");
      return;
    }
    const invalid = lines.find((x) => !/^https:\/\//i.test(x));
    if (invalid) {
      showToast(t("common.admin.bulkUrlInvalidHttps"));
      return;
    }

    setBulkAdding(true);
    let okCount = 0;
    try {
      for (const url of lines) {
        const ok = await postAppendEpisode({ videoUrl: url }, { silent: true });
        if (ok) okCount += 1;
      }
      showToast(
        t("common.admin.bulkUrlAdded", {
          ok: okCount,
          total: lines.length
        }),
        okCount > 0 ? "success" : "error"
      );
      if (okCount > 0) setBulkVideoUrls("");
    } finally {
      setBulkAdding(false);
    }
  };

  const runSeriesHls = async () => {
    if (!series) return;
    setSeriesHlsRunning(true);
    try {
      const res = await fetch("/admin/api/video/transcode-hls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "manual",
          seriesIds: [series.id],
          firstNEpisodesPerSeries: seriesHlsFirstN
        })
      });
      const json = (await res.json()) as {
        ok?: boolean;
        okCount?: number;
        totalJobs?: number;
      };
      if (!res.ok || !json?.ok) {
        showToast(t("common.admin.hlsBatchRunFailed"));
        return;
      }
      showToast(
        t("common.admin.hlsBatchRunDone", {
          ok: json.okCount ?? 0,
          total: json.totalJobs ?? 0
        }),
        "success"
      );
      const all = await fetchAdminJson<{ ok?: boolean; series?: Series[] }>("/admin/api/series");
      if (all.res.ok && all.json?.ok && Array.isArray(all.json.series)) {
        const latest = all.json.series.find((x) => x.id === series.id);
        if (latest) onSeriesUpdated?.(latest);
      }
    } catch {
      showToast(t("common.admin.networkErrorShort"));
    } finally {
      setSeriesHlsRunning(false);
    }
  };

  const refreshEpisodeStatus = async (ep: Episode) => {
    if (!series) return;
    if (!ep.videoStreamId) {
      showToast(t("common.admin.videoStatusNoStreamId"), "info");
      return;
    }
    setRefreshingEpId(ep.id);
    try {
      const res = await fetch("/api/video/stream-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seriesId: series.id,
          episodeId: ep.id,
          streamId: ep.videoStreamId
        })
      });
      const json = (await res.json()) as { ok?: boolean };
      if (!res.ok || !json?.ok) {
        showToast(t("common.admin.videoStatusRefreshFailed"));
        return;
      }
      const all = await fetchAdminJson<{ ok?: boolean; series?: Series[] }>("/admin/api/series");
      if (all.res.ok && all.json?.ok && Array.isArray(all.json.series)) {
        const latest = all.json.series.find((x) => x.id === series.id);
        if (latest) onSeriesUpdated?.(latest);
      }
      showToast(t("common.admin.videoStatusRefreshed"), "success");
    } catch {
      showToast(t("common.admin.networkErrorShort"));
    } finally {
      setRefreshingEpId(null);
    }
  };

  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !series) return;

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 200);

    setAddingEpisode(true);
    try {
      // Phase 1: presign — get R2 upload URL, bypassing Vercel's body limit.
      const { json } = await fetchAdminJson<{
        ok?: boolean;
        items?: Array<{ key: string; uploadUrl: string }>;
        errorKey?: string;
        error?: string;
      }>(
        "/admin/api/upload/video/presign-batch",
        {
          method: "POST",
          body: JSON.stringify({ files: [{ name: safeName, type: file.type || "video/mp4", size: file.size }] }),
          headers: { "Content-Type": "application/json" }
        },
        30000
      );
      if (!json?.ok || !json.items?.[0]) {
        showToast(translateAdminApiError(json as { ok?: boolean; errorKey?: string; error?: string }, t, "admin.saveFailed"), "error");
        setAddingEpisode(false);
        return;
      }

      const { uploadUrl } = json.items[0];

      // Phase 2: PUT directly to R2 (same retry logic as upload/page.tsx).
      await new Promise<void>((resolve, reject) => {
        let attempt = 0;
        const MAX_RETRIES = 3;
        const attemptUpload = () => {
          attempt++;
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl, true);
          xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
          xhr.timeout = 300_000;

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else if (xhr.status >= 400 && xhr.status < 500) {
              reject(new Error(`Upload rejected (HTTP ${xhr.status}). Check R2 CORS policy.`));
            } else {
              if (attempt <= MAX_RETRIES) {
                globalThis.setTimeout(attemptUpload, 1000 * Math.pow(2, attempt - 1));
              } else {
                reject(new Error(`Server error (HTTP ${xhr.status}).`));
              }
            }
          };
          xhr.onerror = () => {
            if (attempt <= MAX_RETRIES) {
              globalThis.setTimeout(attemptUpload, 1000 * Math.pow(2, attempt - 1));
            } else {
              reject(new Error("Network error during upload."));
            }
          };
          xhr.ontimeout = () => {
            if (attempt <= MAX_RETRIES) {
              globalThis.setTimeout(attemptUpload, 1000 * Math.pow(2, attempt - 1));
            } else {
              reject(new Error("Upload timed out."));
            }
          };
          xhr.send(file);
        };
        attemptUpload();
      });

      // Phase 3: append episode with the R2 video URL.
      const key = json.items[0].key;
      const videoUrl = `${process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ?? ""}/${key}`.replace(/^(https?:\/)/, "https://");
      await postAppendEpisode({
        videoUrl,
        sourceFileName: file.name
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("common.admin.networkErrorShort"), "error");
    } finally {
      setAddingEpisode(false);
    }
  };

  /**
   * 重新上传某个已有 episode 的视频：presign → XHR PUT R2 → PATCH episode。
   * 与 upload/page.tsx 逻辑完全一致。
   */
  const handleReuploadEpisode = async (ep: Episode, file: File) => {
    if (!series) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 200);
    setReuploadEpId(ep.id);
    try {
      const { json } = await fetchAdminJson<{
        ok?: boolean;
        items?: Array<{ key: string; uploadUrl: string }>;
        errorKey?: string;
        error?: string;
      }>(
        "/admin/api/upload/video/presign-batch",
        {
          method: "POST",
          body: JSON.stringify({ files: [{ name: safeName, type: file.type || "video/mp4", size: file.size }] }),
          headers: { "Content-Type": "application/json" }
        },
        30000
      );
      if (!json?.ok || !json.items?.[0]) {
        showToast(translateAdminApiError(json as { ok?: boolean; errorKey?: string; error?: string }, t, "admin.saveFailed"), "error");
        return;
      }

      const { uploadUrl } = json.items[0];

      await new Promise<void>((resolve, reject) => {
        let attempt = 0;
        const MAX_RETRIES = 3;
        const attemptUpload = () => {
          attempt++;
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl, true);
          xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
          xhr.timeout = 300_000;
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else if (xhr.status >= 400 && xhr.status < 500) reject(new Error(`Upload rejected (HTTP ${xhr.status}).`));
            else if (attempt <= MAX_RETRIES) globalThis.setTimeout(attemptUpload, 1000 * Math.pow(2, attempt - 1));
            else reject(new Error(`Server error (HTTP ${xhr.status}).`));
          };
          xhr.onerror = () => {
            if (attempt <= MAX_RETRIES) globalThis.setTimeout(attemptUpload, 1000 * Math.pow(2, attempt - 1));
            else reject(new Error("Network error during upload."));
          };
          xhr.ontimeout = () => {
            if (attempt <= MAX_RETRIES) globalThis.setTimeout(attemptUpload, 1000 * Math.pow(2, attempt - 1));
            else reject(new Error("Upload timed out."));
          };
          xhr.send(file);
        };
        attemptUpload();
      });

      const key = json.items[0].key;
      const videoUrl = `${process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ?? ""}/${key}`.replace(/^(https?:\/)/, "https://");
      const { res, json: patchJson } = await fetchAdminJson<{ ok?: boolean; series?: Series }>(
        `/admin/api/series/${series.id}/episodes/${ep.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ videoUrl, videoStatus: "processing" as const }),
          headers: { "Content-Type": "application/json" }
        }
      );
      if (res.ok && patchJson?.ok && patchJson.series) {
        showToast(t("common.admin.episodeReuploadSuccess", { n: ep.index }), "success");
        onSeriesUpdated?.(patchJson.series);
      } else {
        showToast(translateAdminApiError(patchJson as { ok?: boolean; errorKey?: string; error?: string }, t, "admin.saveFailed"), "error");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("common.admin.networkErrorShort"), "error");
    } finally {
      setReuploadEpId(null);
    }
  };

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

    try {
      const { json } = await fetchAdminJson<{ ok?: boolean; key?: string; uploadUrl?: string; errorKey?: string; error?: string }>(
        "/admin/api/upload/cover/presign",
        { method: "POST", body: JSON.stringify({ fileName: safeName }), headers: { "Content-Type": "application/json" } },
        30000
      );
      if (!json?.ok || !json.uploadUrl) {
        showToast(translateAdminApiError(json as { ok?: boolean; errorKey?: string; error?: string }, t, "admin.toastCoverUploadFail"), "error");
        return;
      }

      const uploadUrl: string = json.uploadUrl;
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

      const publicBase = process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ?? "";
      const coverUrl = publicBase
        ? `${publicBase.replace(/\/$/, "")}/${json.key ?? ""}`
        : uploadUrl.split("?")[0];
      setForm((f) => ({ ...f, coverUrl }));
      setCoverImgError(false);
    } catch {
      showToast(t("common.admin.toastCoverUploadFail"), "error");
    }
    e.target.value = "";
  };

  const save = async () => {
    if (!series) return;
    if (!form.title.trim()) {
      showToast(t("common.admin.toastTitleEmpty"));
      return;
    }

    setSaving(true);
    try {
      const tagNames = form.tagIds
        .map((id) => tags.find((x) => x.id === id)?.name)
        .filter((n): n is string => Boolean(n));
      const finalTags =
        tagNames.length > 0 ? tagNames : (series.tags?.length ? series.tags : []);

      const { res, json } = await fetchAdminJson<{
        ok?: boolean;
        error?: string;
        errorKey?: string;
      }>(`/admin/api/series/${series.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          originalName: form.originalName.trim() || undefined,
          localOrTranslated: form.localOrTranslated || undefined,
          description: form.description.trim() || undefined,
          tags: finalTags,
          lockStartIndex: form.lockStartIndex,
          cover: form.coverUrl || undefined,
          poster: form.coverUrl || undefined,
          listed: form.listed
        })
      });
      if (res.ok && json?.ok) {
        showToast(t("common.admin.saveSuccess"), "success");
        onSaved();
      } else {
        showToast(translateAdminApiError(json, t, "admin.saveFailed"));
      }
    } catch {
      showToast(t("common.admin.networkErrorShort"));
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = (id: string) => {
    setForm((f) => ({
      ...f,
      tagIds: f.tagIds.includes(id) ? f.tagIds.filter((t) => t !== id) : [...f.tagIds, id]
    }));
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "fixed right-0 top-0 z-50 flex h-full w-full max-w-xl flex-col bg-zinc-950 shadow-2xl",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-800/80 p-4">
          <h2 className="text-lg font-bold text-zinc-100">{t("common.admin.editDramaTitle")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.editFieldTitle")}</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.editFieldOriginal")}</label>
              <input
                value={form.originalName}
                onChange={(e) => setForm({ ...form, originalName: e.target.value })}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.editFieldType")}</label>
              <select
                value={form.localOrTranslated}
                onChange={(e) =>
                  setForm({
                    ...form,
                    localOrTranslated: e.target.value as typeof form.localOrTranslated
                  })
                }
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100"
              >
                <option value="">{t("common.admin.phSelect")}</option>
                <option value="local">{t("common.admin.localDrama")}</option>
                <option value="translated">{t("common.admin.translatedDrama")}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.editFieldSynopsis")}</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.editFieldTags")}</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tagItem) => (
                  <button
                    key={tagItem.id}
                    type="button"
                    onClick={() => toggleTag(tagItem.id)}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-medium ring-1 transition",
                      form.tagIds.includes(tagItem.id)
                        ? "bg-brand/20 text-brand ring-brand/50"
                        : "bg-zinc-800/60 text-zinc-400 ring-zinc-700"
                    )}
                  >
                    {tagItem.name}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.editFieldLock")}</label>
              <select
                value={form.lockStartIndex}
                onChange={(e) =>
                  setForm({ ...form, lockStartIndex: parseInt(e.target.value, 10) })
                }
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100"
              >
                {Array.from(
                  { length: Math.max(series?.episodes?.length ?? 1, 1) },
                  (_, i) => i + 1
                ).map((n) => (
                  <option key={n} value={n}>
                    {t("common.admin.lockFromEpisodeLabel", { n })}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
              <label className="block text-xs font-semibold text-zinc-400">
                {t("common.admin.editFieldEpisodes")}
              </label>
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                {t("common.admin.editEpisodesHint")}
              </p>
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                {(series?.episodes?.length ?? 0) === 0 ? (
                  <p className="text-xs text-zinc-500">{t("common.admin.episodeListEmpty")}</p>
                ) : (
                  (series?.episodes ?? []).map((ep) => {
                    const isUploading = reuploadEpId === ep.id;
                    const showReupload = ep.videoStatus === "failed" || !ep.videoUrl;
                    return (
                      <div
                        key={ep.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/80 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-zinc-200">
                            {t("common.admin.episodeRowLabel", { n: ep.index })}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ring-1",
                                statusTone(ep.videoStatus)
                              )}
                            >
                              {statusLabel(ep.videoStatus)}
                            </span>
                            <button
                              type="button"
                              disabled={refreshingEpId === ep.id || isUploading}
                              onClick={() => refreshEpisodeStatus(ep)}
                              className="rounded-md border border-zinc-600 px-2 py-1 text-[10px] font-semibold text-zinc-200 hover:bg-zinc-700/60 disabled:opacity-50"
                            >
                              {refreshingEpId === ep.id
                                ? t("common.admin.videoStatusRefreshing")
                                : t("common.admin.videoStatusRefresh")}
                            </button>
                          </div>
                          {ep.sourceFileName ? (
                            <div className="truncate text-[11px] text-zinc-500" title={ep.sourceFileName}>
                              {ep.sourceFileName}
                            </div>
                          ) : ep.videoUrl ? (
                            <div className="truncate text-[11px] text-zinc-500" title={ep.videoUrl}>
                              {ep.videoUrl}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {showReupload && (
                            <label
                              className={cn(
                                "flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition",
                                isUploading
                                  ? "border-amber-500/50 bg-amber-500/10 text-amber-300 opacity-50"
                                  : "border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                              )}
                            >
                              <input
                                type="file"
                                accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.mkv"
                                className="hidden"
                                disabled={isUploading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleReuploadEpisode(ep, file);
                                  e.target.value = "";
                                }}
                              />
                              {isUploading ? t("common.admin.uploading") : t("common.admin.reupload")}
                            </label>
                          )}
                          <button
                            type="button"
                            disabled={deletingEpId === ep.id || isUploading}
                            onClick={() => handleDeleteEpisode(ep)}
                            className="rounded-lg border border-red-500/40 px-2 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/15 disabled:opacity-50"
                          >
                            {deletingEpId === ep.id ? "..." : t("common.admin.delete")}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="mt-3 space-y-2">
                <input
                  type="url"
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  placeholder={t("common.admin.episodeVideoUrlPlaceholder")}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={addingEpisode || bulkAdding || !series}
                    onClick={handleAddEpisodeByUrl}
                    className="rounded-lg bg-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-600 disabled:opacity-50"
                  >
                    {addingEpisode ? t("common.admin.savingShort") : t("common.admin.episodeAddByUrl")}
                  </button>
                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-zinc-600 bg-zinc-800/60 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700/60 disabled:opacity-50">
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.mkv"
                      className="hidden"
                      disabled={addingEpisode || bulkAdding || !series}
                      onChange={handleVideoFile}
                    />
                    {t("common.admin.episodePickVideoFile")}
                  </label>
                </div>
                <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-2">
                  <p className="mb-1 text-[11px] text-zinc-500">{t("common.admin.bulkUrlHint")}</p>
                  <textarea
                    rows={4}
                    value={bulkVideoUrls}
                    onChange={(e) => setBulkVideoUrls(e.target.value)}
                    placeholder={t("common.admin.bulkUrlPlaceholder")}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600"
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      disabled={addingEpisode || bulkAdding || !series}
                      onClick={handleBulkAddEpisodesByUrl}
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      {bulkAdding ? t("common.admin.bulkUrlAdding") : t("common.admin.bulkUrlAddAction")}
                    </button>
                    <span className="text-[11px] text-zinc-500">{t("common.admin.bulkUrlOnlyHttps")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-950/60 px-2 py-2">
                  <span className="text-[11px] text-zinc-400">{t("common.admin.hlsFirstNEpisodes")}</span>
                  <input
                    type="number"
                    min={0}
                    value={seriesHlsFirstN}
                    onChange={(e) => setSeriesHlsFirstN(Math.max(0, Number(e.target.value || 0)))}
                    className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                  />
                  <button
                    type="button"
                    disabled={seriesHlsRunning || addingEpisode || bulkAdding || !series}
                    onClick={runSeriesHls}
                    className="rounded-lg bg-fuchsia-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-fuchsia-500 disabled:opacity-50"
                  >
                    {seriesHlsRunning ? t("common.admin.hlsHotRunning") : t("common.admin.hlsRunCurrentSeries")}
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.editFieldCover")}</label>
              <div className="mt-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-700/60">
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp"
                    onChange={handleCoverUpload}
                    className="hidden"
                  />
                  {t("common.admin.clickUpload")}
                </label>
                {form.coverUrl && (
                  <div className="mt-2">
                    {coverImgError ? (
                      <div className="flex flex-col items-center gap-2 rounded-lg border border-red-500/30 bg-red-950/20 p-4">
                        <div className="text-xs text-red-400">{t("common.admin.coverLoadFailed")}</div>
                        <button
                          type="button"
                          onClick={() => setCoverImgError(false)}
                          className="rounded-md border border-red-500/40 px-3 py-1 text-xs text-red-300 hover:bg-red-500/15"
                        >
                          {t("common.admin.coverRetry")}
                        </button>
                      </div>
                    ) : (
                      <Image
                        unoptimized
                        src={form.coverUrl}
                        alt={t("common.admin.coverAlt")}
                        fill
                        className="object-cover"
                        onError={() => setCoverImgError(true)}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400">{t("common.admin.editFieldListed")}</label>
              <select
                value={form.listed ? "1" : "0"}
                onChange={(e) => setForm({ ...form, listed: e.target.value === "1" })}
                className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-100"
              >
                <option value="1">{t("common.admin.listedOn")}</option>
                <option value="0">{t("common.admin.listedOff")}</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-800/80 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-300"
          >
            {t("common.admin.cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
          >
            {saving ? t("common.admin.savingShort") : t("common.admin.submit")}
          </button>
        </div>
      </div>
    </>
  );
}
