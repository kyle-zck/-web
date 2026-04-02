"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { showToast } from "@/components/ui/toast";
import { translateAdminApiError } from "@/lib/admin/api-error";
import { fetchAdminJson } from "@/lib/admin/fetch-admin-json";
import { backgroundUploadManager, type UploadSession } from "@/lib/upload/background-upload-manager";
import { getAllUploadSessions, isBackgroundUploadSupported } from "@/lib/upload/background-upload-db";

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

interface BackgroundUploadState {
  isEnabled: boolean;
  isInitialized: boolean;
  activeSessionId: string | null;
  backgroundSessions: UploadSession[];
}

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
  const [bgUpload, setBgUpload] = useState<BackgroundUploadState>({
    isEnabled: false,
    isInitialized: false,
    activeSessionId: null,
    backgroundSessions: []
  });
  const [showBgUploadsPanel, setShowBgUploadsPanel] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

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
      setTagsLoadError(String(t("common.admin.networkError")));
    }
  };

  useEffect(() => {
    loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let mounted = true;

    const initBgUpload = async () => {
      const supported = await isBackgroundUploadSupported();
      if (!supported || !mounted) {
        setBgUpload((prev) => ({ ...prev, isEnabled: false, isInitialized: true }));
        return;
      }

      const initialized = await backgroundUploadManager.initialize();
      if (!mounted) return;

      if (initialized) {
        backgroundUploadManager.onStatusChange((sessionId, fileIndex, stage, percent, error) => {
          setUploadFilesProgress((prev) => {
            const key = prev.find((p) => p.key.includes(`-${fileIndex}-`))?.key ||
              `${fileIndex}-unknown-unknown`;
            const existing = prev.find((p) => p.key === key);
            if (!existing) {
              const newKey = `${fileIndex}-file-${fileIndex}`;
              return [...prev, { key: newKey, fileName: `Episode ${fileIndex}`, stage, percent: percent || 0 }];
            }
            return prev.map((p) =>
              p.key === key ? { ...p, stage, percent: percent || p.percent } : p
            );
          });
        });

        backgroundUploadManager.onSessionChange((session) => {
          setBgUpload((prev) => {
            const exists = prev.backgroundSessions.some((s) => s.id === session.id);
            if (exists) {
              return {
                ...prev,
                backgroundSessions: prev.backgroundSessions.map((s) =>
                  s.id === session.id ? session : s
                ),
              };
            }
            return {
              ...prev,
              backgroundSessions: [...prev.backgroundSessions, session],
            };
          });
        });

        const sessions = await getAllUploadSessions();
        setBgUpload({
          isEnabled: true,
          isInitialized: true,
          activeSessionId: null,
          backgroundSessions: sessions,
        });

        cleanupRef.current = () => {
          backgroundUploadManager.destroy();
        };
      } else {
        setBgUpload((prev) => ({ ...prev, isEnabled: false, isInitialized: true }));
      }
    };

    initBgUpload();

    return () => {
      mounted = false;
      cleanupRef.current?.();
    };
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
        showToast(t("common.admin.toastTitleExists"));
        return false;
      }
      return true;
    } catch {
      showToast(t("common.admin.networkErrorShort"), "error");
      return false;
    } finally {
      setChecking(false);
    }
  };

  const validate = (): string | null => {
    if (!form.title.trim()) return t("common.admin.valTitleRequired");
    if (!form.originalName.trim()) return t("common.admin.valOriginalRequired");
    if (!form.localOrTranslated) return t("common.admin.valLocalTypeRequired");
    if (!form.totalEpisodes || form.totalEpisodes < 1) return t("common.admin.valEpisodesPositive");
    if (!form.description.trim()) return t("common.admin.valSynopsisRequired");
    if (form.tagIds.length === 0) return t("common.admin.valTagsRequired");
    if (!form.lockStartIndex || form.lockStartIndex < 1) return t("common.admin.valLockRequired");
    if (!form.coverUrl) return t("common.admin.valCoverRequired");
    if (form.videoFiles.length === 0) return t("common.admin.valVideosRequired");
    if (form.videoFiles.length !== form.totalEpisodes) {
      return t("common.admin.valVideoCountMismatch", {
        a: form.videoFiles.length,
        b: form.totalEpisodes
      });
    }
    return null;
  };

  const handleBackgroundUpload = useCallback(async () => {
    const err = validate();
    if (err) {
      showToast(err);
      return;
    }
    const dupOk = await checkDuplicate();
    if (!dupOk) return;

    if (!bgUpload.isEnabled) {
      showToast(t("common.admin.bgUploadNotSupported"), "info");
      handleSubmit();
      return;
    }

    setSubmitting(true);

    const finalTags = form.tagIds
      .map((id) => tags.find((t) => t.id === id)?.name?.trim())
      .filter((e): e is string => Boolean(e));

    if (finalTags.length === 0) {
      showToast(t("common.admin.valTagsRequired"));
      setSubmitting(false);
      return;
    }

    const sortedVideos = [...form.videoFiles].sort((a, b) => a.index - b.index);

    setUploadFilesProgress(
      sortedVideos.map((v, idx) => ({
        key: `${idx}-${v.file.name}-${v.file.size}`,
        fileName: v.file.name,
        stage: "queued" as const,
        percent: 0
      }))
    );

    const sessionId = await backgroundUploadManager.startUpload(
      {
        title: form.title.trim(),
        originalName: form.originalName.trim(),
        localOrTranslated: form.localOrTranslated || "",
        totalEpisodes: form.totalEpisodes,
        description: form.description.trim(),
        tagIds: finalTags,
        lockStartIndex: form.lockStartIndex,
        coverUrl: form.coverUrl,
        uploadVideoMode: form.uploadVideoMode,
        listed: form.listed
      },
      sortedVideos
    );

    backgroundUploadManager.setActiveFiles(sessionId, sortedVideos);

    setBgUpload((prev) => ({
      ...prev,
      activeSessionId: sessionId,
      backgroundSessions: [
        ...prev.backgroundSessions,
        {
          id: sessionId,
          ownerTabId: null,
          lastHeartbeat: Date.now(),
          formData: {
            title: form.title.trim(),
            originalName: form.originalName.trim(),
            localOrTranslated: form.localOrTranslated || "",
            totalEpisodes: form.totalEpisodes,
            description: form.description.trim(),
            tagIds: finalTags,
            lockStartIndex: form.lockStartIndex,
            coverUrl: form.coverUrl,
            uploadVideoMode: form.uploadVideoMode,
            listed: form.listed
          },
          files: sortedVideos.map((v) => ({
            fileName: v.file.name,
            fileSize: v.file.size,
            fileType: v.file.type || "video/mp4",
            index: v.index,
            stage: "queued",
            percent: 0,
            retryCount: 0
          })),
          status: "pending",
          currentIndex: 0,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ]
    }));

    setShowBgUploadsPanel(true);
    showToast(t("common.admin.bgUploadStarted"), "info");
    setSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, tags, bgUpload.isEnabled, t, validate, checkDuplicate]);

  const handleBgUploadRemove = useCallback(async (sessionId: string) => {
    await backgroundUploadManager.cancelUpload(sessionId);
    setBgUpload((prev) => ({
      ...prev,
      backgroundSessions: prev.backgroundSessions.filter((s) => s.id !== sessionId),
      activeSessionId: prev.activeSessionId === sessionId ? null : prev.activeSessionId
    }));
  }, []);

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      showToast(t("common.admin.toastCoverFormat"));
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
      showToast(t("common.admin.networkErrorShort"), "error");
    }
    e.target.value = "";
  };

  const isVideoLikeFile = (f: File) => {
    const mime = f.type;
    if (mime && mime.startsWith("video/")) return true;
    const ext = f.name.toLowerCase().split(".").pop() ?? "";
    return ["mp4", "webm", "mov", "m4v", "mkv", "avi", "mpeg", "mpg"].includes(ext);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(isVideoLikeFile);
    const parsed = files
      .map((f) => {
        const m = f.name.match(/(\d+)/);
        const index = m ? parseInt(m[1], 10) : 0;
        return { file: f, index: index || 0 };
      })
      .filter((x) => x.index > 0)
      .sort((a, b) => a.index - b.index);
    if (parsed.length === 0 && files.length > 0) {
      showToast(t("common.admin.toastVideoNameParse"));
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
        showToast(t("common.admin.valTagsRequired"));
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
          showToast(t("common.admin.uploadSuccessShort"), "success");
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
        showToast(t("common.admin.uploadDirectFailedUseHttps"));
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
          showToast(t("common.admin.submitFailed"));
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
        showToast(t("common.admin.uploadSuccessShort"), "success");
        setUploadFilesProgress([]);
        setForm((f) => ({ ...f, title: "", originalName: "", localOrTranslated: "", totalEpisodes: 0, description: "", tagIds: [], lockStartIndex: 1, coverUrl: "", videoFiles: [], uploadVideoMode: "mp4", listed: true }));
      } else {
        const base = translateAdminApiError(seriesJson, t, "admin.submitFailed");
        showToast(seriesJson?.traceId ? `${base} (trace: ${seriesJson.traceId})` : base);
      }
    } catch {
      showToast(t("common.admin.networkErrorShort"));
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
    showToast(t("common.admin.toastCancelled"), "info");
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
        {t("common.admin.dramaUpload")}
      </h1>
      <p className="mt-1 text-xs text-zinc-400">{t("common.admin.uploadPageSubtitle")}</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (bgUpload.isEnabled) {
            handleBackgroundUpload();
          } else {
            handleSubmit();
          }
        }}
        className="mt-6 space-y-5 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-6"
      >
        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("common.admin.fieldDramaTitle")} <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={t("common.admin.phTitleDupCheck")}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100 placeholder-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("common.admin.fieldOriginalTitle")} <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            name="originalName"
            value={form.originalName}
            onChange={(e) => setForm({ ...form, originalName: e.target.value })}
            placeholder={t("common.admin.phManualInput")}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100 placeholder-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("common.admin.fieldLocalOrTranslated")} <span className="text-red-400">*</span>
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
            <option value="">{t("common.admin.phSelect")}</option>
            <option value="local">{t("common.admin.localDrama")}</option>
            <option value="translated">{t("common.admin.translatedDrama")}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("common.admin.fieldTotalEpisodes")} <span className="text-red-400">*</span>
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
            placeholder={t("common.admin.phManualInput")}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100 placeholder-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("common.admin.fieldSynopsis")} <span className="text-red-400">*</span>
          </label>
          <textarea
            name="description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            placeholder={t("common.admin.phSynopsis")}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100 placeholder-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("common.admin.fieldTagsRequired")} <span className="text-red-400">*</span>
          </label>
          <p className="mt-1 text-xs text-zinc-500">{t("common.admin.tagsPickHint")}</p>
          {tagsLoadError ? (
            <div className="mt-2 flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              <span>{tagsLoadError}</span>
              <button
                type="button"
                onClick={loadTags}
                className="rounded-md border border-red-400/40 bg-red-500/10 px-2.5 py-1 font-semibold text-red-100 hover:bg-red-500/20"
              >
                {t("common.admin.query")}
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
            {t("common.admin.fieldLockStart")} <span className="text-red-400">*</span>
          </label>
          <p className="mt-1 text-xs text-zinc-500">{t("common.admin.lockStartHint")}</p>
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
                {t("common.admin.lockFromEpisodeLabel", { n })}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("common.admin.fieldCover")} <span className="text-red-400">*</span>
          </label>
          <p className="mt-1 text-xs text-zinc-500">{t("common.admin.coverFormatHint")}</p>
          <div className="mt-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-700/60">
              <input
                type="file"
                name="cover"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={handleCoverUpload}
                className="hidden"
              />
              {t("common.admin.clickUpload")}
            </label>
            {form.coverUrl && (
              <div className="mt-2 flex items-center gap-2">
                <div className="relative aspect-[3/4] h-24 overflow-hidden rounded-lg">
                  <Image
                    src={form.coverUrl}
                    alt={t("common.admin.coverAlt")}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                </div>
                <span className="text-xs text-emerald-400">{t("common.admin.uploaded")}</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("common.admin.fieldVideoFiles")} <span className="text-red-400">*</span>
          </label>
          <p className="mt-1 text-xs text-zinc-500">{t("common.admin.videoBatchHint")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-700/60">
              <input
                type="file"
                name="videos-files"
                accept="video/*"
                multiple
                onChange={handleVideoUpload}
                className="hidden"
              />
              {t("common.admin.videoUploadSelectFiles")}
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-3 text-sm font-medium text-zinc-200 hover:bg-zinc-700/60">
              <input
                type="file"
                name="videos-folder"
                onChange={handleVideoUpload}
                className="hidden"
                {...({ webkitdirectory: "", mozdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
              />
              {t("common.admin.videoUploadSelectFolder")}
            </label>
          </div>
          {form.videoFiles.length > 0 ? (
            <p className="mt-2 text-xs text-emerald-400">
              {t("common.admin.selectedEpisodes", { count: form.videoFiles.length })}
            </p>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("common.admin.fieldVideoMode")}
          </label>
          <p className="mt-1 text-xs text-zinc-500">{t("common.admin.videoModeUploadHint")}</p>
          <select
            name="uploadVideoMode"
            value={form.uploadVideoMode}
            onChange={(e) =>
              setForm({ ...form, uploadVideoMode: e.target.value as "mp4" | "hls" })
            }
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100"
          >
            <option value="mp4">{t("common.admin.videoModeMp4Default")}</option>
            <option value="hls">{t("common.admin.videoModeHlsPreferred")}</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-zinc-300">
            {t("common.admin.fieldListed")} <span className="text-red-400">*</span>
          </label>
          <select
            name="listed"
            value={form.listed ? "1" : "0"}
            onChange={(e) => setForm({ ...form, listed: e.target.value === "1" })}
            className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900/60 px-4 py-3 text-zinc-100"
          >
            <option value="1">{t("common.admin.listedVisible")}</option>
            <option value="0">{t("common.admin.listedHidden")}</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-3 pt-4">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-lg border border-zinc-600 px-6 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-800"
          >
            {t("common.admin.cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting || checking}
            className="flex items-center gap-2 rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {submitting
              ? uploadProgress
                ? t("common.admin.videoUploadingProgress", {
                    current: uploadProgress.current,
                    total: uploadProgress.total
                  })
                : t("common.admin.bgUploadStarting")
              : checking
                ? t("common.admin.submitting")
                : t("common.admin.bgUploadStart")}
          </button>
        </div>
        {uploadProgress ? (
          <p className="text-xs text-amber-300">
            {t("common.admin.videoUploadingFile", { name: uploadProgress.fileName })}
          </p>
        ) : null}
        {uploadFilesProgress.length > 0 ? (
          <div className="space-y-2 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
            {uploadFilesProgress.map((it) => (
              <div key={it.key} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="max-w-[70%] truncate text-zinc-300">{it.fileName}</span>
                  <span className="text-zinc-400">
                    {t(`common.admin.uploadStage_${it.stage}`)} {it.stage === "uploading" ? `${it.percent}%` : ""}
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

      {bgUpload.backgroundSessions.length > 0 && (
        <div className="mt-6 rounded-2xl border border-emerald-800/40 bg-emerald-950/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-sm font-semibold text-emerald-300">
                {t("common.admin.bgUploadPanelTitle")}
              </h3>
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                {bgUpload.backgroundSessions.length}
              </span>
            </div>
            <button
              onClick={() => setShowBgUploadsPanel(!showBgUploadsPanel)}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              {showBgUploadsPanel ? t("common.admin.hide") : t("common.admin.show")}
            </button>
          </div>

          {showBgUploadsPanel && (
            <div className="space-y-3">
              {bgUpload.backgroundSessions.map((session) => {
                const doneCount = session.files.filter((f) => f.stage === "done").length;
                const failedCount = session.files.filter((f) => f.stage === "failed").length;
                const uploadingCount = session.files.filter((f) => f.stage === "uploading" || f.stage === "presign" || f.stage === "completing").length;
                const totalCount = session.files.length;

                const donePercent = (doneCount / totalCount) * 100;
                const uploadingPercent = session.files
                  .filter((f) => f.stage === "uploading")
                  .reduce((sum, f) => sum + (f.percent || 0), 0) / totalCount;
                const overallPercent = Math.round(donePercent + uploadingPercent);

                return (
                  <div
                    key={session.id}
                    className="rounded-lg border border-zinc-700/50 bg-zinc-900/50 p-3"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-zinc-200">{session.formData.title}</p>
                        <p className="text-xs text-zinc-500">
                          {overallPercent}%
                          <span className="ml-1">
                            ({doneCount}/{totalCount}
                            {uploadingCount > 0 && ` + ${uploadingCount} ${t("common.admin.uploadingShort")}`}
                            {failedCount > 0 && `, ${failedCount} ${t("common.admin.failedShort")}`})
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs ${
                          session.status === "completed"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : session.status === "failed"
                            ? "bg-red-500/20 text-red-300"
                            : session.status === "paused"
                            ? "bg-yellow-500/20 text-yellow-300"
                            : "bg-blue-500/20 text-blue-300"
                        }`}>
                          {overallPercent}%
                        </span>
                        <button
                          onClick={() => handleBgUploadRemove(session.id)}
                          className="rounded-md border border-zinc-600 px-2 py-1 text-xs text-zinc-400 hover:border-red-500 hover:text-red-400"
                        >
                          {t("common.admin.remove")}
                        </button>
                      </div>
                    </div>

                    <div className="mb-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className={`h-full transition-all ${
                          session.status === "failed" ? "bg-red-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${overallPercent}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {session.files.slice(0, 4).map((file) => (
                        <div key={file.index} className="flex items-center gap-2 text-xs">
                          <span className={`h-2 w-2 rounded-full ${
                            file.stage === "done"
                              ? "bg-emerald-500"
                              : file.stage === "failed"
                              ? "bg-red-500"
                              : file.stage === "uploading"
                              ? "bg-blue-500 animate-pulse"
                              : "bg-zinc-600"
                          }`} />
                          <span className="truncate text-zinc-400">
                            {t(`common.admin.uploadStage_${file.stage}`)}
                            {file.stage === "uploading" ? ` ${file.percent}%` : ""}
                          </span>
                        </div>
                      ))}
                      {session.files.length > 4 && (
                        <p className="col-span-2 text-xs text-zinc-500">
                          +{session.files.length - 4} {t("common.admin.moreFiles")}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
