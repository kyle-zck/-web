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
  const [batchReuploadOpen, setBatchReuploadOpen] = useState(false);
  const [batchReuploadFiles, setBatchReuploadFiles] = useState<Record<string, File>>({});
  const [batchReuploadRunning, setBatchReuploadRunning] = useState(false);

  /** 视频批量上传相关状态 */
  const [pendingVideos, setPendingVideos] = useState<{ file: File; index: number }[]>([]);
  const [videoUploadProgress, setVideoUploadProgress] = useState<Record<number, {
    stage: "queued" | "presign" | "uploading" | "completing" | "done" | "failed";
    percent: number;
    error?: string;
  }>>({});

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
    setPendingVideos([]);
    setVideoUploadProgress({});
  }, [series?.id]);

  const sampleVideoUrl = () =>
    process.env.NEXT_PUBLIC_SAMPLE_VIDEO_URL?.trim() ||
    "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

  const isVideoLikeFile = (f: File) => {
    const mime = f.type;
    if (mime && mime.startsWith("video/")) return true;
    const ext = f.name.toLowerCase().split(".").pop() ?? "";
    return ["mp4", "webm", "mov", "m4v", "mkv", "avi", "mpeg", "mpg"].includes(ext);
  };

  function topLevelDir(webkitRelativePath: string): string {
    if (!webkitRelativePath) return "";
    const slashIdx = webkitRelativePath.indexOf("/");
    return slashIdx < 0 ? "" : webkitRelativePath.slice(0, slashIdx);
  }

  /**
   * 批量视频上传入口：支持文件夹选择和批量文件选择。
   * 文件名中提取集数，自动按集数排序。
   */
  const handleVideoBatchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = Array.from(e.target.files ?? []).filter(isVideoLikeFile);
    if (raw.length === 0) {
      e.target.value = "";
      return;
    }

    const sorted = [...raw].sort((a, b) =>
      (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, undefined, { numeric: true })
    );

    const dirs = new Set(sorted.map((f) => topLevelDir(f.webkitRelativePath || "")));
    const hasSubfolders = dirs.size > 1 || (!dirs.has("") && dirs.size === 1);
    const chosenDir = dirs.size === 1 && dirs.has("") ? "" : [...dirs][0] ?? "";

    const files = hasSubfolders
      ? sorted.filter((f) => topLevelDir(f.webkitRelativePath || "") === chosenDir)
      : sorted;

/**
 * 从文件名中提取集数。
 * 支持格式：
 *   8 / 08 / 008                      → 8
 *   Episode 8 / Episode 08             → 8
 *   E8 / E08                           → 8
 *   EP8 / EP08                         → 8
 *   S01E08 / S1E8 / s01ep08           → 8
 *   第8集 / 第08集                     → 8
 * 返回 0 表示未匹配到有效集数。
 */
function parseEpisodeIndex(fileName: string): number {
  const name = fileName.replace(/[._-]/g, " ").trim();
  const patterns = [
    /(?:s\d+)?e(\d+)/i,          // S01E08 / E08 / s01e08
    /(?:s\d+)?ep(\d+)/i,         // EP08 / ep08
    /(?:s\d+)?p(\d+)/i,          // P08 / p08 (less common)
    /episode\s*(\d+)/i,           // Episode 8
    /第\s*(\d+)\s*集/i,          // 第8集 / 第 8 集
    /^(\d+)(?:\s|$|\.)/,          // 8 / 08 / 008 (standalone number at start)
  ];
  for (const re of patterns) {
    const m = name.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > 0) return n;
    }
  }
  return 0;
}

    const parsed = files
      .map((f) => {
        const index = parseEpisodeIndex(f.name);
        return { file: f, index };
      })
      .filter((x) => x.index > 0)
      .sort((a, b) => a.index - b.index);

    if (parsed.length === 0 && files.length > 0) {
      showToast(t("common.admin.toastVideoNameParse"));
      e.target.value = "";
      return;
    }

    setPendingVideos(parsed);
    setVideoUploadProgress(
      parsed.reduce<Record<number, { stage: "queued"; percent: number }>>((acc, v) => {
        acc[v.index] = { stage: "queued", percent: 0 };
        return acc;
      }, {})
    );
    e.target.value = "";
  };

  /**
   * 批量视频上传执行函数：对齐 drama-upload 的上传逻辑。
   * presign 批量获取 URL → XHR 直传 R2 → PATCH 分集。
   */
  const runBatchVideoUpload = async () => {
    if (!series || pendingVideos.length === 0) return;
    setAddingEpisode(true);
    setBatchReuploadRunning(true);

    const sorted = [...pendingVideos].sort((a, b) => a.index - b.index);
    const total = sorted.length;
    const progressKeyMap = new Map(sorted.map((v, i) => [`${i}-${v.file.name}-${v.file.size}`, v.index]));

    const updateProg = (index: number, patch: { stage: string; percent?: number; error?: string }) => {
      setVideoUploadProgress((prev) => {
        if (!prev[index]) return prev;
        return { ...prev, [index]: { ...prev[index], ...patch } as typeof prev[number] };
      });
    };

    const putByXhr = async (
      url: string,
      file: File,
      onProgress?: (p: number) => void
    ): Promise<void> => {
      const MAX_RETRIES = 3;
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
        if (attempt > 1) await new Promise((r) => globalThis.setTimeout(r, 1000 * Math.pow(2, attempt - 2)));
        try {
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", url, true);
            xhr.timeout = 300_000;
            xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
            xhr.upload.onprogress = (ev) => {
              if (!ev.lengthComputable) return;
              onProgress?.(Math.round((ev.loaded / ev.total) * 100));
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) resolve();
              else if (xhr.status >= 400 && xhr.status < 500) reject(new Error(`Upload rejected (HTTP ${xhr.status})`));
              else reject(new Error(`Server error (HTTP ${xhr.status})`));
            };
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.ontimeout = () => reject(new Error("Upload timed out"));
            xhr.send(file);
          });
          return;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          const msg = lastError.message;
          if (msg.includes("rejected") || msg.includes("HTTP 4")) throw lastError;
          if (attempt <= MAX_RETRIES) onProgress?.(0);
        }
      }
      throw lastError ?? new Error("Upload failed");
    };

    try {
      // Phase 1: 批量 presign
      const { json: presignJson } = await fetchAdminJson<{
        ok?: boolean;
        items?: Array<{ key: string; uploadUrl: string }>;
        errorKey?: string; error?: string;
      }>(
        "/admin/api/upload/video/presign-batch",
        {
          method: "POST",
          body: JSON.stringify({ files: sorted.map((v) => ({
            name: v.file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 200),
            type: v.file.type || "video/mp4",
            size: v.file.size
          })) }),
          headers: { "Content-Type": "application/json" }
        },
        30000
      );

      if (!presignJson?.ok || !Array.isArray(presignJson.items) || presignJson.items.length === 0) {
        showToast(translateAdminApiError(presignJson as { ok?: boolean; errorKey?: string; error?: string }, t, "admin.saveFailed"), "error");
        setAddingEpisode(false);
        setBatchReuploadRunning(false);
        return;
      }

      const presignedMap = new Map(presignJson.items.map((item, i) => [`${i}-${sorted[i].file.name}-${sorted[i].file.size}`, item]));

      // Phase 2: 并行 XHR 上传
      let cursor = 0;
      const workerCount = Math.min(3, total);
      const results: Array<{ index: number; key: string; uploadUrl: string } | null> = new Array(total).fill(null);

      await Promise.all(
        Array.from({ length: workerCount }).map(async () => {
          while (cursor < total) {
            const current = cursor;
            cursor += 1;
            const v = sorted[current];
            const progressKey = `${current}-${v.file.name}-${v.file.size}`;
            const presigned = presignedMap.get(progressKey);
            const epIdx = progressKeyMap.get(progressKey);
            if (!presigned || epIdx === undefined) {
              if (epIdx !== undefined) updateProg(epIdx, { stage: "failed", error: "Presign failed" });
              continue;
            }
            updateProg(epIdx, { stage: "presign", percent: 0 });
            updateProg(epIdx, { stage: "uploading", percent: 1 });
            try {
              await putByXhr(presigned.uploadUrl, v.file, (p) => updateProg(epIdx, { stage: "uploading", percent: p }));
              updateProg(epIdx, { stage: "completing", percent: 100 });
              results[current] = { index: epIdx, key: presigned.key, uploadUrl: presigned.uploadUrl };
              updateProg(epIdx, { stage: "done", percent: 100 });
            } catch (err) {
              updateProg(epIdx, { stage: "failed", error: err instanceof Error ? err.message : "Upload failed" });
            }
          }
        })
      );

      // Phase 3: 逐集 PATCH
      let okCount = 0;
      for (const result of results) {
        if (!result) continue;
        const publicBase = process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ?? "";
        const videoUrl = `${publicBase.replace(/\/$/, "")}/${result.key}`.replace(/^(https?:\/)/, "https://");
        const ok = await postAppendEpisode(
          { videoUrl, sourceFileName: sorted[results.indexOf(result)].file.name },
          { silent: true }
        );
        if (ok) okCount++;
      }

      if (okCount > 0) {
        showToast(t("common.admin.batchVideoUploadDone", { ok: okCount, total }), "success");
        setPendingVideos([]);
        setVideoUploadProgress({});
      } else {
        showToast(t("common.admin.batchVideoUploadFailed"), "error");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : t("common.admin.networkErrorShort"), "error");
    } finally {
      setAddingEpisode(false);
      setBatchReuploadRunning(false);
    }
  };

  /** 清除待上传队列 */
  const handleClearPendingVideos = () => {
    setPendingVideos([]);
    setVideoUploadProgress({});
  };

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

  /**
   * 批量重传：收集已选文件，并行上传所有集。
   */
  const runBatchReupload = async () => {
    if (!series) return;
    const entries = Object.entries(batchReuploadFiles);
    if (entries.length === 0) {
      showToast(t("common.admin.batchReuploadNoFiles"), "info");
      return;
    }
    setBatchReuploadRunning(true);
    let success = 0;
    let fail = 0;
    await Promise.allSettled(
      entries.map(async ([epId, file]) => {
        const ep = series.episodes?.find((e) => e.id === epId);
        if (!ep) return;
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 200);
        try {
          const { json } = await fetchAdminJson<{
            ok?: boolean;
            items?: Array<{ key: string; uploadUrl: string }>;
            errorKey?: string;
          }>(
            "/admin/api/upload/video/presign-batch",
            {
              method: "POST",
              body: JSON.stringify({ files: [{ name: safeName, type: file.type || "video/mp4", size: file.size }] }),
              headers: { "Content-Type": "application/json" }
            },
            30000
          );
          if (!json?.ok || !json.items?.[0]) { fail++; return; }
          const { uploadUrl } = json.items[0];
          const MAX_RETRIES = 3;
          let uploadOk = false;
          for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
            try {
              await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open("PUT", uploadUrl, true);
                xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
                xhr.timeout = 300_000;
                xhr.onload = () => {
                  if (xhr.status >= 200 && xhr.status < 300) resolve();
                  else reject(new Error(`HTTP ${xhr.status}`));
                };
                xhr.onerror = () => reject(new Error("Network error"));
                xhr.ontimeout = () => reject(new Error("Upload timed out"));
                xhr.send(file);
              });
              uploadOk = true;
              break;
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              if (msg.includes("rejected") || msg.startsWith("HTTP 4")) throw err;
              if (attempt <= MAX_RETRIES) await new Promise((r) => globalThis.setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
              else throw err;
            }
          }
          if (!uploadOk) { fail++; return; }
          const key = json.items[0].key;
          const videoUrl = `${process.env.NEXT_PUBLIC_S3_PUBLIC_BASE_URL ?? ""}/${key}`.replace(/^(https?:\/)/, "https://");
          const { res, json: patchJson } = await fetchAdminJson<{ ok?: boolean; series?: Series }>(
            `/admin/api/series/${series.id}/episodes/${epId}`,
            { method: "PATCH", body: JSON.stringify({ videoUrl, videoStatus: "processing" as const }), headers: { "Content-Type": "application/json" } }
          );
          if (res.ok && patchJson?.ok && patchJson.series) {
            onSeriesUpdated?.(patchJson.series);
            success++;
          } else { fail++; }
        } catch { fail++; }
        finally { setReuploadEpId((prev) => (prev === epId ? null : prev)); }
      })
    );
    setBatchReuploadRunning(false);
    setBatchReuploadFiles({});
    setBatchReuploadOpen(false);
    if (success > 0) showToast(t("common.admin.batchReuploadDone", { ok: success, fail }), "success");
    else if (fail > 0) showToast(t("common.admin.batchReuploadFailed", { fail }), "error");
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
      const { json } = await fetchAdminJson<{ ok?: boolean; key?: string; uploadUrl?: string; publicUrl?: string; errorKey?: string; error?: string }>(
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

      const coverUrl = json.publicUrl ?? json.uploadUrl.split("?")[0];
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
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400">
                    {t("common.admin.editFieldEpisodes")}
                  </label>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                    {t("common.admin.editEpisodesHint")}
                  </p>
                </div>
                {((series?.episodes ?? []).length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      setBatchReuploadFiles({});
                      setBatchReuploadOpen(true);
                    }}
                    className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {t("common.admin.batchReupload")}
                  </button>
                )}
              </div>
              <div className="mt-3 max-h-48 space-y-2 overflow-y-auto pr-1">
                {(series?.episodes?.length ?? 0) === 0 ? (
                  <p className="text-xs text-zinc-500">{t("common.admin.episodeListEmpty")}</p>
                ) : (
                  (series?.episodes ?? []).map((ep) => {
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
                              disabled={refreshingEpId === ep.id || addingEpisode || bulkAdding || batchReuploadRunning}
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
                          <label
                            title={t("common.admin.reuploadFile")}
                            className={cn(
                              "inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold transition",
                              reuploadEpId === ep.id
                                ? "border-amber-500/50 bg-amber-500/10 text-amber-400 opacity-60 cursor-not-allowed"
                                : "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20"
                            )}
                          >
                            <input
                              type="file"
                              accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.mkv"
                              className="hidden"
                              disabled={reuploadEpId === ep.id}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) await handleReuploadEpisode(ep, file);
                                e.target.value = "";
                              }}
                            />
                            {reuploadEpId === ep.id ? "..." : t("common.admin.reupload")}
                          </label>
                          <button
                            type="button"
                            disabled={deletingEpId === ep.id}
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
              <div className="mt-3 space-y-3">
                {/* 视频文件批量上传 */}
                <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-3">
                  <p className="mb-2 text-[11px] font-semibold text-zinc-400">{t("common.admin.videoBatchHint")}</p>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-brand/50 bg-brand/10 px-3 py-2 text-xs font-semibold text-brand hover:bg-brand/20">
                      <input
                        type="file"
                        accept="video/*"
                        multiple
                        onChange={handleVideoBatchUpload}
                        className="hidden"
                      />
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      {t("common.admin.videoUploadSelectFiles")}
                    </label>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800/60 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700/60">
                      <input
                        type="file"
                        onChange={handleVideoBatchUpload}
                        className="hidden"
                        {...({ webkitdirectory: "", mozdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
                      />
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      {t("common.admin.videoUploadSelectFolder")}
                    </label>
                    {pendingVideos.length > 0 && (
                      <button
                        type="button"
                        disabled={batchReuploadRunning}
                        onClick={runBatchVideoUpload}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        {batchReuploadRunning ? t("common.admin.uploading") : t("common.admin.batchVideoUploadStart")}
                        <span className="text-[10px] opacity-70">({pendingVideos.length})</span>
                      </button>
                    )}
                    {pendingVideos.length > 0 && (
                      <button
                        type="button"
                        disabled={batchReuploadRunning}
                        onClick={handleClearPendingVideos}
                        className="rounded-lg border border-zinc-600 px-3 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-700/60 disabled:opacity-50"
                      >
                        {t("common.admin.clear")}
                      </button>
                    )}
                  </div>

                  {/* 待上传视频列表 */}
                  {pendingVideos.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                      {pendingVideos
                        .slice()
                        .sort((a, b) => a.index - b.index)
                        .map((v) => {
                          const prog = videoUploadProgress[v.index];
                          const stageLabel: Record<string, string> = {
                            queued: t("common.admin.uploadStage_queued"),
                            presign: t("common.admin.uploadStage_presign"),
                            uploading: t("common.admin.uploadStage_uploading"),
                            completing: t("common.admin.uploadStage_completing"),
                            done: t("common.admin.uploadStage_done"),
                            failed: t("common.admin.uploadStage_failed"),
                          };
                          return (
                            <div key={v.index} className="flex items-center gap-2 rounded px-2 py-1.5 bg-zinc-900/60">
                              <span className="w-6 shrink-0 text-[11px] font-mono text-zinc-500">#{v.index}</span>
                              <span className="flex-1 truncate text-[11px] text-zinc-300" title={v.file.name}>{v.file.name}</span>
                              {prog && (
                                <>
                                  <span className={`shrink-0 text-[10px] font-medium ${
                                    prog.stage === "failed" ? "text-red-400" :
                                    prog.stage === "done" ? "text-emerald-400" :
                                    prog.stage === "uploading" ? "text-blue-400" : "text-zinc-500"
                                  }`}>
                                    {stageLabel[prog.stage] ?? prog.stage}
                                    {prog.stage === "uploading" && prog.percent > 0 ? ` ${prog.percent}%` : ""}
                                  </span>
                                  {prog.stage === "failed" && prog.error && (
                                    <span className="max-w-[80px] truncate text-[10px] text-red-400/70" title={prog.error}>{"!"}</span>
                                  )}
                                </>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* URL 方式单条/批量添加 */}
                <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/60 p-2">
                  <p className="mb-1 text-[11px] text-zinc-500">{t("common.admin.episodeByUrlHint")}</p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={newVideoUrl}
                      onChange={(e) => setNewVideoUrl(e.target.value)}
                      placeholder={t("common.admin.episodeVideoUrlPlaceholder")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAddEpisodeByUrl();
                        }
                      }}
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600"
                    />
                    <button
                      type="button"
                      disabled={addingEpisode || bulkAdding || !series}
                      onClick={handleAddEpisodeByUrl}
                      className="rounded-lg bg-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-600 disabled:opacity-50"
                    >
                      {addingEpisode ? "..." : t("common.admin.episodeAddByUrl")}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-600">{t("common.admin.bulkUrlHint")}</p>
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

      {/* 批量重传弹窗 */}
      {batchReuploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-700 px-5 py-4">
              <h3 className="text-sm font-semibold text-zinc-100">{t("common.admin.batchReupload")}</h3>
              <button
                type="button"
                onClick={() => setBatchReuploadOpen(false)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[60vh] space-y-2 overflow-y-auto px-5 py-4">
              {(series?.episodes ?? []).map((ep) => {
                const file = batchReuploadFiles[ep.id];
                return (
                  <div key={ep.id} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-zinc-200">
                        {t("common.admin.episodeRowLabel", { n: ep.index })}
                      </div>
                      <span className={cn("mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1", statusTone(ep.videoStatus))}>
                        {statusLabel(ep.videoStatus)}
                      </span>
                      {file && <div className="mt-1 truncate text-[11px] text-amber-400">{file.name}</div>}
                    </div>
                    <label className={cn(
                      "flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold transition",
                      file ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-zinc-600 bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                    )}>
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.mkv"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) setBatchReuploadFiles((prev) => ({ ...prev, [ep.id]: f }));
                          e.target.value = "";
                        }}
                      />
                      {file ? file.name.slice(0, 20) : t("common.admin.pickFile")}
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 border-t border-zinc-700 px-5 py-4">
              <button
                type="button"
                onClick={() => setBatchReuploadOpen(false)}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
              >
                {t("common.admin.cancel")}
              </button>
              <button
                type="button"
                disabled={batchReuploadRunning || Object.keys(batchReuploadFiles).length === 0}
                onClick={runBatchReupload}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {batchReuploadRunning && (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {batchReuploadRunning ? t("common.admin.uploading") : t("common.admin.batchReuploadStart")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
