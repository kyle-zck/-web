"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "@/components/ui/toast";
import { translateAdminApiError } from "@/lib/admin/api-error";
import { fetchAdminJson } from "@/lib/admin/fetch-admin-json";

/** 来自「管理标签」目录 drama-tag-catalog */
interface TagItem {
  id: string;
  name: string;
}

type UploadStage = "queued" | "presign" | "uploading" | "completing" | "done" | "failed";
type UploadFileProgress = {
  key: string;
  fileName: string;
  stage: UploadStage;
  percent: number;
};

export default function AdminDramaUploadPage() {
  const { t } = useTranslation();
  const isLocalDevHost =
    typeof window !== "undefined" &&
    /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [tagsLoadError, setTagsLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    originalName: "",
    localOrTranslated: "" as "" | "local" | "translated",
    totalEpisodes: 0,
    description: "",
    tagIds: [] as string[],
    lockStartIndex: 1,
    coverUrl: "",
    videoFiles: [] as { file: File; index: number }[],
    uploadVideoMode: "mp4" as "mp4" | "hls",
    listed: true
  });
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [uploadFilesProgress, setUploadFilesProgress] = useState<UploadFileProgress[]>([]);

  const suggestWorkerCount = (total: number) => {
    if (total <= 1) return total;
    if (isLocalDevHost) return Math.min(2, total);
    if (typeof navigator === "undefined") return Math.min(2, total);
    const nav = navigator as Navigator & {
      connection?: {
        effectiveType?: string;
        saveData?: boolean;
      };
    };
    const conn = nav.connection;
    if (!conn) return Math.min(2, total);
    if (conn.saveData) return 1;
    const type = (conn.effectiveType ?? "").toLowerCase();
    if (type.includes("2g")) return 1;
    if (type.includes("3g")) return Math.min(2, total);
    if (type.includes("4g")) return Math.min(3, total);
    return Math.min(2, total);
  };

  const loadTags = async () => {
    setTagsLoadError(null);
    try {
      const { res, json } = await fetchAdminJson<{ ok?: boolean; items?: TagItem[]; errorKey?: string }>(
        "/admin/api/drama-tag-catalog",
        undefined,
        10000
      );
      if (res.ok && json?.ok && Array.isArray(json.items)) {
        setTags(json.items);
      } else {
        setTags([]);
        setTagsLoadError(translateAdminApiError(json, t, "admin.submitFailed"));
      }
    } catch {
      setTags([]);
      setTagsLoadError(String(t("admin.networkError")));
    }
  };

  useEffect(() => {
    loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkDuplicate = async () => {
    const name = form.title.trim();
    if (!name) return true;
    setChecking(true);
    try {
      const { res, json } = await fetchAdminJson<{ ok?: boolean; duplicate?: boolean; errorKey?: string }>(
        "/admin/api/series/check-title",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: name })
        },
        10000
      );
      if (!res.ok || !json?.ok) {
        showToast(translateAdminApiError(json, t, "admin.submitFailed"), "error");
        return false;
      }
      if (json?.duplicate) {
        showToast(t("admin.toastTitleExists"));
        return false;
      }
      return true;
    } catch {
      showToast(t("admin.networkErrorShort"), "error");
      return false;
    } finally {
      setChecking(false);
    }
  };

  const validate = (): string | null => {
    if (!form.title.trim()) return t("admin.valTitleRequired");
    if (!form.originalName.trim()) return t("admin.valOriginalRequired");
    if (!form.localOrTranslated) return t("admin.valLocalTypeRequired");
    if (!form.totalEpisodes || form.totalEpisodes < 1) return t("admin.valEpisodesPositive");
    if (!form.description.trim()) return t("admin.valSynopsisRequired");
    if (form.tagIds.length === 0) return t("admin.valTagsRequired");
    if (!form.lockStartIndex || form.lockStartIndex < 1) return t("admin.valLockRequired");
    if (!form.coverUrl) return t("admin.valCoverRequired");
    if (form.videoFiles.length === 0) return t("admin.valVideosRequired");
    if (form.videoFiles.length !== form.totalEpisodes) {
      return t("admin.valVideoCountMismatch", {
        a: form.videoFiles.length,
        b: form.totalEpisodes
      });
    }
    return null;
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      showToast(t("admin.toastCoverFormat"));
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    try {
      const controller = new AbortController();
      const timer = globalThis.setTimeout(() => controller.abort(), 30000);
      const { res, json } = await fetchAdminJson<{ ok?: boolean; coverUrl?: string; errorKey?: string }>(
        "/admin/api/upload/cover",
        { method: "POST", body: fd, signal: controller.signal },
        30000
      ).finally(() => globalThis.clearTimeout(timer));
      if (res.ok && json?.ok && json.coverUrl) {
        const nextCover = json.coverUrl as string;
        setForm((f) => ({ ...f, coverUrl: nextCover }));
      } else {
        showToast(translateAdminApiError(json, t, "admin.toastCoverUploadFail"), "error");
      }
    } catch {
      showToast(t("admin.networkErrorShort"), "error");
    }
    e.target.value = "";
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const parsed = files
      .map((f) => {
        const m = f.name.match(/(\d+)/);
        const index = m ? parseInt(m[1], 10) : 0;
        return { file: f, index: index || 0 };
      })
      .filter((x) => x.index > 0)
      .sort((a, b) => a.index - b.index);
    if (parsed.length === 0 && files.length > 0) {
      showToast(t("admin.toastVideoNameParse"));
      return;
    }
    setForm((f) => ({ ...f, videoFiles: parsed }));
    e.target.value = "";
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      showToast(err);
      return;
    }
    const dupOk = await checkDuplicate();
    if (!dupOk) return;

    setSubmitting(true);
    try {
      const coverUrl = form.coverUrl;
      const finalTags = form.tagIds
        .map((id) => tags.find((t) => t.id === id)?.name?.trim())
        .filter((e): e is string => Boolean(e));
      if (finalTags.length === 0) {
        showToast(t("admin.valTagsRequired"));
        setSubmitting(false);
        return;
      }

      const sortedVideos = [...form.videoFiles].sort((a, b) => a.index - b.index);
      const total = sortedVideos.length;

      const updateUploadFileProgress = (
        key: string,
        patch: Partial<Pick<UploadFileProgress, "stage" | "percent">>
      ) => {
        setUploadFilesProgress((prev) =>
          prev.map((it) => (it.key === key ? { ...it, ...patch } : it))
        );
      };

      setUploadFilesProgress(
        sortedVideos.map((v, idx) => ({
          key: `${idx}-${v.file.name}-${v.file.size}`,
          fileName: v.file.name,
          stage: "queued",
          percent: 0
        }))
      );

      const putByXhr = (
        url: string,
        file: File,
        onProgress?: (percent: number) => void,
        timeoutMs = 300_000
      ) =>
        new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", url, true);
          xhr.timeout = timeoutMs;
          xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
          xhr.upload.onprogress = (evt) => {
            if (!evt.lengthComputable) return;
            const percent = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
            onProgress?.(percent);
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`put failed: ${xhr.status}`));
          };
          xhr.onerror = () => reject(new Error("put network error"));
          xhr.ontimeout = () => reject(new Error("put timeout"));
          xhr.send(file);
        });

      // Phase 1: batch presign — single API round-trip for all files
      const { res: presignRes, json: presignJson } = await fetchAdminJson<{
        ok?: boolean;
        items?: Array<{ key: string; uploadUrl: string; publicUrl: string }>;
        errorKey?: string;
      }>(
        "/admin/api/upload/video/presign-batch",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            files: sortedVideos.map((v) => ({
              fileName: v.file.name,
              contentType: v.file.type || "video/mp4"
            }))
          })
        },
        30000
      );

      // Fallback: per-file presign (for old servers without batch endpoint)
      if (!presignRes.ok || !presignJson?.ok || !Array.isArray(presignJson.items)) {
        const perFilePresign = await Promise.all(
          sortedVideos.map(async (v) => {
            const key = `videos/${Date.now()}-${Math.random().toString(36).slice(2)}-${v.file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120)}`;
            return { key };
          })
        );

        // Parallel upload with per-file presign inside each worker
        const byOrder: Array<{
          videoUrl: string;
          videoStreamId?: string;
          videoPlaybackUrl?: string;
          videoStatus?: "processing" | "ready" | "failed";
          fileName: string;
        } | undefined> = new Array(total);

        let cursor = 0;
        let doneCount = 0;
        const workerCount = suggestWorkerCount(total);
        await Promise.all(
          Array.from({ length: workerCount }).map(async () => {
            while (cursor < total) {
              const current = cursor;
              cursor += 1;
              const v = sortedVideos[current];
              const progressKey = `${current}-${v.file.name}-${v.file.size}`;
              setUploadProgress({ current: Math.min(doneCount + 1, total), total, fileName: v.file.name });

              const maxRetries = 2;
              for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
                try {
                  updateUploadFileProgress(progressKey, { stage: "presign", percent: 0 });
                  const { res: pRes, json: pJson } = await fetchAdminJson<{
                    ok?: boolean; uploadUrl?: string; key?: string; publicUrl?: string;
                  }>(
                    "/admin/api/upload/video/presign",
                    { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ fileName: v.file.name, contentType: v.file.type || "video/mp4" }) },
                    10000
                  );
                  if (!pRes.ok || !pJson?.ok || !pJson.uploadUrl) throw new Error("presign unavailable");

                  updateUploadFileProgress(progressKey, { stage: "uploading", percent: 1 });
                  await putByXhr(pJson.uploadUrl, v.file,
                    (p) => updateUploadFileProgress(progressKey, { stage: "uploading", percent: p }), 300_000);

                  updateUploadFileProgress(progressKey, { stage: "completing", percent: 100 });
                  const { res: cRes, json: cJson } = await fetchAdminJson<{
                    ok?: boolean; videoUrl?: string; videoStreamId?: string;
                    videoPlaybackUrl?: string; videoStatus?: "processing" | "ready" | "failed";
                  }>("/admin/api/upload/video", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ uploadedKey: pJson.key, uploadedUrl: pJson.publicUrl, targetMode: form.uploadVideoMode })
                  });
                  if (!cRes.ok || !cJson?.ok || !cJson.videoUrl) throw new Error("complete failed");
                  updateUploadFileProgress(progressKey, { stage: "done", percent: 100 });
                  byOrder[current] = {
                    videoUrl: cJson.videoUrl!, videoStreamId: cJson.videoStreamId,
                    videoPlaybackUrl: cJson.videoPlaybackUrl, videoStatus: cJson.videoStatus, fileName: v.file.name
                  };
                  doneCount += 1;
                  break;
                } catch {
                  if (attempt > maxRetries) {
                    updateUploadFileProgress(progressKey, { stage: "failed" });
                    doneCount += 1;
                  } else {
                    await new Promise((r) => globalThis.setTimeout(r, 800 * attempt));
                  }
                }
              }
            }
          })
        );

        const uploaded = byOrder.filter((x): x is NonNullable<typeof x> => Boolean(x && x.videoUrl));
        setUploadProgress(null);

        const episodeUrls = uploaded.map((x) => x.videoUrl);
        const episodeVideoMeta = uploaded.map((x) => ({
          fileName: x.fileName,
          localVideoUrl: `file:///${x.fileName.replace(/\\/g, "/")}`,
          videoStreamId: x.videoStreamId,
          videoPlaybackUrl: x.videoPlaybackUrl,
          videoStatus: x.videoStatus
        }));

        const { res: seriesRes, json: seriesJson } = await fetchAdminJson<{
          ok?: boolean; errorKey?: string; error?: string; traceId?: string;
        }>("/admin/api/series", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: form.title.trim(), originalName: form.originalName.trim(),
            localOrTranslated: form.localOrTranslated || undefined,
            description: form.description.trim(), tags: finalTags,
            coverDataUrl: coverUrl, episodeVideoUrls: episodeUrls,
            episodeVideoMeta, lockStartIndex: form.lockStartIndex, listed: form.listed
          })
        });
        if (seriesRes.ok && seriesJson?.ok) {
          showToast(t("admin.uploadSuccessShort"), "success");
          setUploadFilesProgress([]);
          setForm((f) => ({ ...f, title: "", originalName: "", localOrTranslated: "", totalEpisodes: 0, description: "", tagIds: [], lockStartIndex: 1, coverUrl: "", videoFiles: [], uploadVideoMode: "mp4", listed: true }));
        } else {
          const base = translateAdminApiError(seriesJson, t, "admin.submitFailed");
          showToast(seriesJson?.traceId ? `${base} (trace: ${seriesJson.traceId})` : base);
        }
        return;
      }

      // Phase 1b: mark all files as ready (presign done)
      sortedVideos.forEach((v, idx) => {
        updateUploadFileProgress(`${idx}-${v.file.name}-${v.file.size}`, { stage: "uploading", percent: 0 });
      });

      // Phase 2: parallel XHR upload (workers share the presigned URLs — no per-file API calls)
      const presignedMap = new Map(presignJson.items.map((item, i) => [`${i}-${sortedVideos[i].file.name}-${sortedVideos[i].file.size}`, item]));
      const byOrder: Array<{
        key: string; publicUrl: string;
      } | undefined> = new Array(total);

      let cursor = 0;
      let doneCount = 0;
      const workerCount = suggestWorkerCount(total);
      await Promise.all(
        Array.from({ length: workerCount }).map(async () => {
          while (cursor < total) {
            const current = cursor;
            cursor += 1;
            const v = sortedVideos[current];
            const progressKey = `${current}-${v.file.name}-${v.file.size}`;
            setUploadProgress({ current: Math.min(doneCount + 1, total), total, fileName: v.file.name });
            const presigned = presignedMap.get(progressKey);
            if (!presigned) {
              updateUploadFileProgress(progressKey, { stage: "failed" });
              doneCount += 1;
              continue;
            }
            try {
              await putByXhr(
                presigned.uploadUrl,
                v.file,
                (p) => updateUploadFileProgress(progressKey, { stage: "uploading", percent: p }),
                300_000
              );
              updateUploadFileProgress(progressKey, { stage: "completing", percent: 100 });
              byOrder[current] = { key: presigned.key, publicUrl: presigned.publicUrl };
              doneCount += 1;
            } catch {
              updateUploadFileProgress(progressKey, { stage: "failed" });
              doneCount += 1;
            }
          }
        })
      );

      const succeeded = byOrder.filter((x): x is NonNullable<typeof x> => Boolean(x));
      if (succeeded.length === 0) {
        showToast(t("admin.uploadDirectFailedUseHttps"));
        setSubmitting(false);
        return;
      }

      // Phase 3: batch complete — MP4 无需此步，HLS 才调用
      let uploaded: Array<{
        videoUrl: string; videoStreamId?: string;
        videoPlaybackUrl?: string; videoStatus?: "processing" | "ready" | "failed"; fileName: string;
      }> = [];

      if (form.uploadVideoMode === "hls") {
        setUploadFilesProgress((prev) =>
          prev.map((it) => (it.stage !== "failed" ? { ...it, stage: "completing" as const, percent: 100 } : it))
        );
        const { res: completeRes, json: completeJson } = await fetchAdminJson<{
          ok?: boolean;
          items?: Array<{ videoUrl: string; videoStreamId?: string;
            videoPlaybackUrl?: string; videoStatus?: "processing" | "ready" | "failed"; }>;
          errorKey?: string;
        }>(
          "/admin/api/upload/video/complete-batch",
          {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              videos: byOrder
                .filter((x): x is NonNullable<typeof x> => Boolean(x))
                .map((x) => ({ uploadedKey: x.key, uploadedUrl: x.publicUrl, targetMode: form.uploadVideoMode }))
            })
          },
          30000
        );
        if (!completeRes.ok || !completeJson?.ok || !Array.isArray(completeJson.items)) {
          setUploadFilesProgress((prev) =>
            prev.map((it) => (it.stage === "completing" ? { ...it, stage: "failed" } : it))
          );
          showToast(t("admin.submitFailed"));
          setSubmitting(false);
          return;
        }
        const completeItemsMap = new Map(completeJson.items.map((c) => [c.videoUrl, c]));
        uploaded = sortedVideos
          .map((v, idx) => {
            const done = byOrder[idx];
            if (!done) return null;
            const meta = completeItemsMap.get(done.publicUrl) ??
              [...completeItemsMap.values()].find((c) => c.videoUrl.includes(done.key)) ??
              { videoUrl: done.publicUrl };
            return {
              videoUrl: meta.videoUrl,
              videoStreamId: meta.videoStreamId,
              videoPlaybackUrl: meta.videoPlaybackUrl,
              videoStatus: meta.videoStatus,
              fileName: v.file.name
            };
          })
          .filter((x): x is NonNullable<typeof x> => Boolean(x && x.videoUrl));
      } else {
        // MP4: PUT 成功即完成，publicUrl 就是最终 videoUrl
        uploaded = sortedVideos
          .map((v, idx) => {
            const done = byOrder[idx];
            if (!done) return null;
            return {
              videoUrl: done.publicUrl,
              videoStreamId: undefined,
              videoPlaybackUrl: done.publicUrl,
              videoStatus: "ready" as const,
              fileName: v.file.name
            };
          })
          .filter((x): x is NonNullable<typeof x> => Boolean(x && x.videoUrl));
      }

      uploaded.forEach((_, idx) => {
        updateUploadFileProgress(`${idx}-${sortedVideos[idx].file.name}-${sortedVideos[idx].file.size}`, { stage: "done", percent: 100 });
      });
      setUploadProgress(null);

      const episodeUrls = uploaded.map((x) => x.videoUrl);
      const episodeVideoMeta = uploaded.map((x) => ({
        fileName: x.fileName,
        localVideoUrl: `file:///${x.fileName.replace(/\\/g, "/")}`,
        videoStreamId: x.videoStreamId,
        videoPlaybackUrl: x.videoPlaybackUrl,
        videoStatus: x.videoStatus
      }));

      const { res: seriesRes, json: seriesJson } = await fetchAdminJson<{
        ok?: boolean; errorKey?: string; error?: string; traceId?: string;
      }>("/admin/api/series", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(), originalName: form.originalName.trim(),
          localOrTranslated: form.localOrTranslated || undefined,
          description: form.description.trim(), tags: finalTags,
          coverDataUrl: coverUrl, episodeVideoUrls: episodeUrls,
          episodeVideoMeta, lockStartIndex: form.lockStartIndex, listed: form.listed
        })
      });
      if (seriesRes.ok && seriesJson?.ok) {
        showToast(t("admin.uploadSuccessShort"), "success");
        setUploadFilesProgress([]);
        setForm((f) => ({ ...f, title: "", originalName: "", localOrTranslated: "", totalEpisodes: 0, description: "", tagIds: [], lockStartIndex: 1, coverUrl: "", videoFiles: [], uploadVideoMode: "mp4", listed: true }));
      } else {
        const base = translateAdminApiError(seriesJson, t, "admin.submitFailed");
        showToast(seriesJson?.traceId ? `${base} (trace: ${seriesJson.traceId})` : base);
      }
    } catch {
      showToast(t("admin.networkErrorShort"));
    } finally {
      setUploadProgress(null);
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setForm({
      title: "",
      originalName: "",
      localOrTranslated: "",
      totalEpisodes: 0,
      description: "",
      tagIds: [],
      lockStartIndex: 1,
      coverUrl: "",
      videoFiles: [],
      uploadVideoMode: "mp4",
      listed: true
    });
    showToast(t("admin.toastCancelled"), "info");
  };

  const toggleTag = (id: string) => {
    setForm((f) => ({
      ...f,
      tagIds: f.tagIds.includes(id) ? f.tagIds.filter((t) => t !== id) : [...f.tagIds, id]
    }));
  };

  return (
    <main className="max-w-2xl">
      <h1 className="text-xl font-extrabold text-zinc-100">
        {t("admin.dramaUpload")}
      </h1>
      <p className="mt-1 text-xs text-zinc-400">{t("admin.uploadPageSubtitle")}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="mt-6 space-y-5 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6"
      >
        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldDramaTitle")} <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t("admin.phTitleDupCheck")}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100 placeholder-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldOriginalTitle")} <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="originalName"
            value={form.originalName}
            onChange={(e) => setForm({ ...form, originalName: e.target.value })}
            placeholder={t("admin.phManualInput")}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100 placeholder-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldLocalOrTranslated")} <span className="text-red-400">*</span>
          </label>
          <select
            name="localOrTranslated"
            value={form.localOrTranslated}
            onChange={(e) =>
              setForm({
                ...form,
                localOrTranslated: e.target.value as "" | "local" | "translated"
              })
            }
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100"
          >
            <option value="">{t("admin.phSelect")}</option>
            <option value="local">{t("admin.localDrama")}</option>
            <option value="translated">{t("admin.translatedDrama")}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldTotalEpisodes")} <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            name="totalEpisodes"
            min={1}
            value={form.totalEpisodes || ""}
            onChange={(e) =>
              setForm({
                ...form,
                totalEpisodes: Math.max(0, parseInt(e.target.value, 10) || 0)
              })
            }
            placeholder={t("admin.phManualInput")}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100 placeholder-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldSynopsis")} <span className="text-red-400">*</span>
          </label>
          <textarea
            name="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            placeholder={t("admin.phSynopsis")}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100 placeholder-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldTagsRequired")} <span className="text-red-400">*</span>
          </label>
          <p className="mt-1 text-xs text-zinc-500">{t("admin.tagsPickHint")}</p>
          {tagsLoadError ? (
            <div className="mt-2 flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              <span>{tagsLoadError}</span>
              <button
                type="button"
                onClick={loadTags}
                className="rounded-md border border-red-400/40 bg-red-500/10 px-2.5 py-1 font-semibold text-red-100 hover:bg-red-500/20"
              >
                {t("admin.query")}
              </button>
            </div>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tagItem) => (
              <button
                key={tagItem.id}
                type="button"
                onClick={() => toggleTag(tagItem.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium ring-1 transition ${
                  form.tagIds.includes(tagItem.id)
                    ? "bg-brand/20 text-brand ring-brand/50"
                    : "bg-zinc-800/60 text-zinc-400 ring-zinc-700 hover:text-zinc-200"
                }`}
              >
                {tagItem.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldLockStart")} <span className="text-red-400">*</span>
          </label>
          <p className="mt-1 text-xs text-zinc-500">{t("admin.lockStartHint")}</p>
          <select
            name="lockStartIndex"
            value={form.lockStartIndex}
            onChange={(e) =>
              setForm({ ...form, lockStartIndex: parseInt(e.target.value, 10) })
            }
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100"
          >
            {Array.from(
              { length: Math.max(form.totalEpisodes || 1, 1) },
              (_, i) => i + 1
            ).map((n) => (
              <option key={n} value={n}>
                {t("admin.lockFromEpisodeLabel", { n })}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldCover")} <span className="text-red-400">*</span>
          </label>
          <p className="mt-1 text-xs text-zinc-500">{t("admin.coverFormatHint")}</p>
          <div className="mt-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-700/60">
              <input
                type="file"
                name="cover"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={handleCoverUpload}
                className="hidden"
              />
              {t("admin.clickUpload")}
            </label>
            {form.coverUrl && (
              <div className="mt-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.coverUrl}
                  alt={t("admin.coverAlt")}
                  className="aspect-[3/4] h-24 rounded-lg object-cover"
                />
                <span className="text-xs text-emerald-400">{t("admin.uploaded")}</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldVideoFiles")} <span className="text-red-400">*</span>
          </label>
          <p className="mt-1 text-xs text-zinc-500">{t("admin.videoBatchHint")}</p>
          <div className="mt-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-700/60">
              <input
                type="file"
                name="videos"
                accept="video/*"
                multiple
                onChange={handleVideoUpload}
                className="hidden"
                {...({ webkitdirectory: "", mozdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
              />
              {t("admin.clickUpload")}
            </label>
            {form.videoFiles.length > 0 && (
              <p className="mt-2 text-xs text-emerald-400">
                {t("admin.selectedEpisodes", { count: form.videoFiles.length })}
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldVideoMode")}
          </label>
          <p className="mt-1 text-xs text-zinc-500">{t("admin.videoModeUploadHint")}</p>
          <select
            name="uploadVideoMode"
            value={form.uploadVideoMode}
            onChange={(e) =>
              setForm({ ...form, uploadVideoMode: e.target.value as "mp4" | "hls" })
            }
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100"
          >
            <option value="mp4">{t("admin.videoModeMp4Default")}</option>
            <option value="hls">{t("admin.videoModeHlsPreferred")}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("admin.fieldListed")} <span className="text-red-400">*</span>
          </label>
          <select
            name="listed"
            value={form.listed ? "1" : "0"}
            onChange={(e) => setForm({ ...form, listed: e.target.value === "1" })}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100"
          >
            <option value="1">{t("admin.listedVisible")}</option>
            <option value="0">{t("admin.listedHidden")}</option>
          </select>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-zinc-600 px-6 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
          >
            {t("admin.cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting || checking}
            className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
          >
            {submitting
              ? uploadProgress
                ? t("admin.videoUploadingProgress", {
                    current: uploadProgress.current,
                    total: uploadProgress.total
                  })
                : t("admin.submitting")
              : checking
                ? t("admin.submitting")
                : t("admin.submit")}
          </button>
        </div>
        {uploadProgress ? (
          <p className="text-xs text-amber-300">
            {t("admin.videoUploadingFile", { name: uploadProgress.fileName })}
          </p>
        ) : null}
        {uploadFilesProgress.length > 0 ? (
          <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
            {uploadFilesProgress.map((it) => (
              <div key={it.key} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="max-w-[70%] truncate text-zinc-300">{it.fileName}</span>
                  <span className="text-zinc-400">
                    {t(`admin.uploadStage_${it.stage}`)} {it.stage === "uploading" ? `${it.percent}%` : ""}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded bg-zinc-800">
                  <div
                    className={`h-full transition-all ${
                      it.stage === "failed" ? "bg-red-500" : "bg-brand"
                    }`}
                    style={{ width: `${it.stage === "failed" ? 100 : it.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </form>
    </main>
  );
}
