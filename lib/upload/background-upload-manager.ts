import {
  saveUploadSession,
  getUploadSession,
  getAllUploadSessions,
  deleteUploadSession,
  saveFileData,
  getFileData,
  deleteFileData,
  generateSessionId,
  claimSession,
  touchSessionHeartbeat,
  updateSessionFileProgress,
  TAB_HEARTBEAT_INTERVAL_MS,
  type UploadSession,
} from "./background-upload-db";

const SW_FILENAME = "/sw-upload.js";
const CHANNEL_NAME = "bg-upload-channel";
/** Base concurrency cap — raised per-file up to MAX_CONCURRENT_UPLOADS when files are few. */
const MAX_CONCURRENT_UPLOADS = 5;
const MAX_RETRIES = 3;
/** How many files each batch-presign call requests at once. */
const PRESIGN_BATCH_SIZE = 10;

type UploadStatusCallback = (
  sessionId: string,
  fileIndex: number,
  status: "queued" | "presign" | "uploading" | "completing" | "done" | "failed",
  percent?: number,
  error?: string
) => void;

type SessionStatusCallback = (session: UploadSession) => void;

type SwUploadWaiter = {
  resolve: (v: { publicUrl: string; key: string }) => void;
  reject: (e: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

class BackgroundUploadManager {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private statusCallback: UploadStatusCallback | null = null;
  private sessionCallback: SessionStatusCallback | null = null;
  private activeSessionId: string | null = null;
  private pendingFiles: Map<string, { file: File; index: number }[]> = new Map();
  /** Resolves when Service Worker finishes PUT for a given file (see `sendToServiceWorker`). */
  private swUploadWaiters = new Map<string, SwUploadWaiter>();
  /** Unique ID for this browser tab — used to isolate multi-tab uploads. */
  private tabId: string = "";
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  private static swWaitKey(sessionId: string, fileIndex: number): string {
    return `${sessionId}:${fileIndex}`;
  }

  /** All session IDs this tab is currently actively uploading. */
  private activeSessionIds = new Set<string>();

  private addActiveSession(sessionId: string) {
    this.activeSessionIds.add(sessionId);
    this.activeSessionId = sessionId; // keep ref for backward compat
  }

  private removeActiveSession(sessionId: string) {
    this.activeSessionIds.delete(sessionId);
    // reassign ref to a remaining active session so heartbeat stays on something alive
    const next = [...this.activeSessionIds][0] ?? null;
    this.activeSessionId = next;
  }

  async initialize(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    if (!("serviceWorker" in navigator)) {
      console.warn("Service Worker not supported");
      return false;
    }

    this.tabId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    try {
      this.swRegistration = await navigator.serviceWorker.register(SW_FILENAME, {
        scope: "/",
      });

      // Auto-update: when a new SW version is installed, reload the page
      // so all code runs against the fresh SW instead of a stale cached copy.
      this.swRegistration.addEventListener("updatefound", () => {
        const newSw = this.swRegistration!.installing;
        if (!newSw) return;
        newSw.addEventListener("statechange", () => {
          if (newSw.state === "installed" && navigator.serviceWorker.controller) {
            console.info("[SW] New service worker installed — reloading to activate.");
            window.location.reload();
          }
        });
      });

      this.broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
      this.broadcastChannel.onmessage = this.handleServiceWorkerMessage.bind(this);

      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "get-progress" });
      }

      this.startHeartbeat();
      await this.resumePendingUploads();

      return true;
    } catch (err) {
      console.error("Failed to initialize Service Worker:", err);
      return false;
    }
  }

  onStatusChange(callback: UploadStatusCallback) {
    this.statusCallback = callback;
  }

  onSessionChange(callback: SessionStatusCallback) {
    this.sessionCallback = callback;
  }

  private handleServiceWorkerMessage(event: MessageEvent) {
    const data = event.data;

    if (data.tabId && data.tabId !== this.tabId) return;

    if (data.type === "progress" && data.sessionId && data.fileIndex !== undefined) {
      this.statusCallback?.(data.sessionId, data.fileIndex, "uploading", data.percent);
    } else if (data.type === "complete" && data.sessionId && data.fileIndex !== undefined) {
      void this.onSwUploadComplete(
        data.sessionId,
        data.fileIndex,
        data.publicUrl as string | undefined,
        data.key as string | undefined
      );
    } else if (data.type === "error" && data.sessionId && data.fileIndex !== undefined) {
      void this.onSwUploadError(data.sessionId, data.fileIndex, data.error as string | undefined);
    } else if (data.type === "heartbeat") {
      this.checkPendingSessions();
    }
  }

  private async onSwUploadComplete(
    sessionId: string,
    fileIndex: number,
    publicUrl: string | undefined,
    key: string | undefined
  ) {
    const session = await getUploadSession(sessionId);
    if (!session) return;
    const idx = session.files.findIndex((f) => f.index === fileIndex);
    if (idx < 0) return;

    const prev = session.files[idx];
    session.files[idx] = {
      ...prev,
      stage: "done",
      percent: 100,
      publicUrl: publicUrl ?? prev.publicUrl,
      key: key ?? prev.key,
    };
    await saveUploadSession(session);

    this.statusCallback?.(sessionId, fileIndex, "done", 100);
    this.sessionCallback?.(session);

    const wk = BackgroundUploadManager.swWaitKey(sessionId, fileIndex);
    const waiter = this.swUploadWaiters.get(wk);
    if (waiter) {
      clearTimeout(waiter.timeout);
      this.swUploadWaiters.delete(wk);
      waiter.resolve({
        publicUrl: session.files[idx].publicUrl ?? "",
        key: session.files[idx].key ?? "",
      });
    }
  }

  private async onSwUploadError(sessionId: string, fileIndex: number, error?: string) {
    const session = await getUploadSession(sessionId);
    if (!session) return;
    const idx = session.files.findIndex((f) => f.index === fileIndex);
    if (idx < 0) return;
    session.files[idx] = {
      ...session.files[idx],
      stage: "failed",
      percent: 0,
      error: error,
    };
    await saveUploadSession(session);

    this.statusCallback?.(sessionId, fileIndex, "failed", undefined, error);
    this.sessionCallback?.(session);

    const wk = BackgroundUploadManager.swWaitKey(sessionId, fileIndex);
    const waiter = this.swUploadWaiters.get(wk);
    if (waiter) {
      clearTimeout(waiter.timeout);
      this.swUploadWaiters.delete(wk);
      waiter.reject(new Error(error || "Upload failed"));
    }
  }

  private async checkPendingSessions() {
    const sessions = await getAllUploadSessions();
    sessions
      .filter((s) => s.status === "uploading" || s.status === "pending")
      .forEach((session) => {
        this.sessionCallback?.(session);
      });
  }

  /** Periodically refresh the heartbeat for all sessions this tab is actively processing. */
  private startHeartbeat() {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(async () => {
      // Update heartbeat for every session this tab owns so none goes stale
      for (const sessionId of this.activeSessionIds) {
        await touchSessionHeartbeat(sessionId, this.tabId);
      }
    }, TAB_HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Creates a new upload session for the given files.  Multiple sessions can run
   * concurrently — heartbeats are sent for all of them so no session goes stale
   * when the user starts a second upload while the first is still running.
   */
  async startUpload(
    formData: UploadSession["formData"],
    files: { file: File; index: number }[],
    /** Called synchronously with the new id before any await (avoids UI progress race). */
    onSessionId?: (sessionId: string) => void
  ): Promise<string> {
    const sessionId = generateSessionId();
    onSessionId?.(sessionId);

    const session: UploadSession = {
      id: sessionId,
      ownerTabId: this.tabId,
      lastHeartbeat: Date.now(),
      formData,
      files: files.map((f) => ({
        fileName: f.file.name,
        fileSize: f.file.size,
        fileType: f.file.type || "video/mp4",
        index: f.index,
        stage: "queued",
        percent: 0,
        retryCount: 0,
      })),
      status: "pending",
      currentIndex: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await saveUploadSession(session);

    for (const f of files) {
      await saveFileData({
        sessionId,
        fileIndex: f.index,
        fileName: f.file.name,
        fileType: f.file.type || "video/mp4",
        fileSize: f.file.size,
        data: f.file,
      });
    }

    // Register this session so heartbeat keeps it alive while concurrent sessions run
    this.addActiveSession(sessionId);
    console.log(`[startUpload] about to call processQueue for ${sessionId}`);

    this.processQueue(sessionId);

    return sessionId;
  }

  private async processQueue(sessionId: string) {
    console.log(`[processQueue] START sessionId=${sessionId}, tabId=${this.tabId}`);
    const claimed = await claimSession(sessionId, this.tabId);
    console.log(`[processQueue] claimSession=${claimed} for sessionId=${sessionId}`);
    if (!claimed) {
      this.removeActiveSession(sessionId);
      console.log(`[processQueue] NOT CLAIMED — removing ${sessionId} from active set`);
      return;
    }

    const session = await getUploadSession(sessionId);
    console.log(`[processQueue] session=${session ? "found" : "NOT FOUND"} for ${sessionId}`);
    if (!session) {
      this.removeActiveSession(sessionId);
      return;
    }

    // Guard: if session is paused, stop scheduling new uploads
    // but keep it registered so the heartbeat survives.
    if (session.status === "paused") return;

    session.status = "uploading";
    session.lastHeartbeat = Date.now();
    await saveUploadSession(session);
    this.addActiveSession(sessionId);
    console.log(`[processQueue] set status=uploading, activeSessionIds=${[...this.activeSessionIds]}`);

    const pendingFiles = session.files.filter(
      (f) => f.stage === "queued" || f.stage === "failed"
    );
    console.log(`[processQueue] pendingFiles count=${pendingFiles.length}, ids=${pendingFiles.map(f => f.index)}`);

    // Dynamic concurrency: raise cap when few files remain so they finish sooner
    const effectiveCap = Math.min(
      MAX_CONCURRENT_UPLOADS,
      Math.max(2, pendingFiles.length)
    );
    const batches: typeof pendingFiles[] = [];
    for (let i = 0; i < pendingFiles.length; i += effectiveCap) {
      batches.push(pendingFiles.slice(i, i + effectiveCap));
    }

    for (const batch of batches) {
      // Guard: re-check pause flag before each batch
      const recheck = await getUploadSession(sessionId);
      if (!recheck || recheck.status === "paused") return;

      // Heartbeat refresh during a long upload run
      await touchSessionHeartbeat(sessionId, this.tabId);
      await Promise.all(
        batch.map((fileInfo) => this.uploadFile(sessionId, fileInfo.index))
      );
    }

    const updatedSession = await getUploadSession(sessionId);
    if (updatedSession) {
      const allDone = updatedSession.files.every((f) => f.stage === "done");
      const anyDone = updatedSession.files.some((f) => f.stage === "done");
      const anyFailed = updatedSession.files.some((f) => f.stage === "failed");

      if (allDone) {
        updatedSession.status = "completed";
        await saveUploadSession(updatedSession);
        await this.createSeries(sessionId, updatedSession);
      } else if (anyDone) {
        // Partial success: create series with what we have, broadcast error for missing ones.
        updatedSession.status = "failed";
        await saveUploadSession(updatedSession);
        await this.createSeries(sessionId, updatedSession);
      } else if (anyFailed) {
        // All failed — mark failed without creating series.
        updatedSession.status = "failed";
        await saveUploadSession(updatedSession);
      }
    }

    // Unregister this session so heartbeat stops sending it once it reaches a terminal state.
    this.removeActiveSession(sessionId);
  }

  private async uploadFile(sessionId: string, fileIndex: number) {
    console.log(`[uploadFile] START sessionId=${sessionId} fileIndex=${fileIndex}`);
    const session = await getUploadSession(sessionId);
    console.log(`[uploadFile] session=${session ? "found" : "NOT FOUND"}, status=${session?.status}`);
    if (!session || session.status === "paused") {
      console.log(`[uploadFile] EARLY RETURN — !session=${!session}, paused=${session?.status === "paused"}`);
      return;
    }

    const fileIdx = session.files.findIndex((f) => f.index === fileIndex);
    console.log(`[uploadFile] fileIdx=${fileIdx}`);
    if (fileIdx < 0) return;

    const fileInfo = session.files[fileIdx];
    // Always re-read from IndexedDB at the start of each attempt so we never work with stale data.
    await updateSessionFileProgress(sessionId, fileIndex, { stage: "presign", percent: 0 });
    this.statusCallback?.(sessionId, fileIndex, "presign", 0);

    // Batch presign: prefetch presigned URLs for this file + its peers to save round-trips.
    const queuedFiles = session.files
      .filter((f) => f.stage === "queued" || f.stage === "failed")
      .sort((a, b) => a.index - b.index);

    const batchSize = Math.min(queuedFiles.length, PRESIGN_BATCH_SIZE);
    const peerFiles = queuedFiles.slice(0, batchSize);

    try {
      const presignRes = await fetch("/admin/api/upload/video/presign-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: peerFiles.map((f) => ({
            fileName: f.fileName,
            contentType: f.fileType || "video/mp4",
          })),
        }),
      });

      if (!presignRes.ok) throw new Error(`Presign failed (HTTP ${presignRes.status})`);

      const presignJson = (await presignRes.json()) as {
        ok?: boolean;
        items?: Array<{ fileName: string; key: string; uploadUrl: string; publicUrl?: string }>;
      };

      if (!presignJson.ok || !Array.isArray(presignJson.items)) {
        throw new Error("Invalid presign batch response");
      }

      // Resolve presigned URLs in IndexedDB for every peer so they don't re-fetch on retry.
      for (const item of presignJson.items) {
        const peerIdx = session.files.findIndex((f) => f.index === peerFiles.find((p) => p.fileName === item.fileName)?.index);
        if (peerIdx >= 0) {
          session.files[peerIdx] = {
            ...session.files[peerIdx],
            uploadUrl: item.uploadUrl,
            publicUrl: item.publicUrl,
            key: item.key,
          };
        }
      }
      await saveUploadSession(session);

      // Re-fetch the specific file's record so it has uploadUrl/key/publicUrl.
      const updatedSession = await getUploadSession(sessionId);
      const targetFileIdx = updatedSession?.files.findIndex((f) => f.index === fileIndex) ?? -1;
      if (targetFileIdx < 0) return;
      const targetFile = updatedSession!.files[targetFileIdx];

      if (!targetFile.uploadUrl) {
        throw new Error("Presigned URL not found for this file");
      }

      this.statusCallback?.(sessionId, fileIndex, "uploading", 1);
      await updateSessionFileProgress(sessionId, fileIndex, { stage: "uploading", percent: 1 });

      // Route: Service Worker (background tab) vs. direct upload (main thread fallback).
      console.log(`[uploadFile] routing to SW (sw=${!!this.swRegistration?.active})`);
      if (this.swRegistration?.active) {
        await this.sendToServiceWorker(sessionId, fileIndex);
      } else {
        await this.uploadDirect(sessionId, fileIndex);
      }
      console.log(`[uploadFile] DONE sessionId=${sessionId} fileIndex=${fileIndex}`);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Upload failed";
      const updated = await getUploadSession(sessionId);
      const fi = updated?.files.find((f) => f.index === fileIndex);
      if (!fi) return;

      if (fi.retryCount < MAX_RETRIES) {
        fi.retryCount += 1;
        fi.stage = "queued";
        await updateSessionFileProgress(sessionId, fileIndex, {
          retryCount: fi.retryCount,
          stage: "queued",
        });
        const delay = 1000 * fi.retryCount;
        setTimeout(() => this.uploadFile(sessionId, fileIndex), delay);
      } else {
        fi.stage = "failed";
        fi.error = errorMsg;
        await updateSessionFileProgress(sessionId, fileIndex, { stage: "failed", error: errorMsg });
        this.statusCallback?.(sessionId, fileIndex, "failed", undefined, errorMsg);
      }
    }
  }

  private async sendToServiceWorker(sessionId: string, fileIndex: number) {
    const session = await getUploadSession(sessionId);
    if (!session) return;

    const fileIdx = session.files.findIndex((f) => f.index === fileIndex);
    if (fileIdx < 0) return;
    const fileInfo = session.files[fileIdx];

    if (!fileInfo.uploadUrl) {
      const errorMsg = "Presigned URL not found";
      await updateSessionFileProgress(sessionId, fileIndex, { stage: "failed", error: errorMsg });
      this.statusCallback?.(sessionId, fileIndex, "failed", undefined, errorMsg);
      throw new Error(errorMsg);
    }

    const storedFileData = await getFileData(sessionId, fileIndex);
    if (!storedFileData) {
      const errorMsg = "File data not found in IndexedDB";
      await updateSessionFileProgress(sessionId, fileIndex, { stage: "failed", error: errorMsg });
      this.statusCallback?.(sessionId, fileIndex, "failed", undefined, errorMsg);
      throw new Error(errorMsg);
    }

    const fileData = new File([storedFileData.data], storedFileData.fileName, {
      type: storedFileData.fileType,
    });
    const arrayBuffer = await fileData.arrayBuffer();

    const wk = BackgroundUploadManager.swWaitKey(sessionId, fileIndex);
    const waitPromise = new Promise<{ publicUrl: string; key: string }>((resolve, reject) => {
      const timeout = globalThis.setTimeout(() => {
        this.swUploadWaiters.delete(wk);
        reject(new Error("Service Worker upload timeout after 10 minutes"));
      }, 600_000);
      this.swUploadWaiters.set(wk, { resolve, reject, timeout });
    });

    console.log(`[sendToServiceWorker] posting to SW sessionId=${sessionId} fileIndex=${fileIndex} url=${fileInfo.uploadUrl?.slice(0, 80)}`);
    this.swRegistration!.active!.postMessage({
      type: "start",
      sessionId,
      fileIndex,
      tabId: this.tabId,
      fileData: {
        name: storedFileData.fileName,
        type: storedFileData.fileType,
        size: storedFileData.fileSize,
        data: arrayBuffer,
      },
      presignedUrl: fileInfo.uploadUrl,
    });
    console.log(`[sendToServiceWorker] message sent, waiting for completion...`);

    // SwUploadComplete will resolve the promise and update IndexedDB.
    // On timeout/reject the outer catch in uploadFile handles retry/failure.
    await waitPromise;
  }

  private async uploadDirect(sessionId: string, fileIndex: number): Promise<void> {
    const session = await getUploadSession(sessionId);
    const fileIdx = session?.files.findIndex((f) => f.index === fileIndex) ?? -1;
    if (fileIdx < 0) return;
    const fileInfo = session!.files[fileIdx];

    if (!fileInfo.uploadUrl) {
      await updateSessionFileProgress(sessionId, fileIndex, { stage: "failed", error: "Missing upload URL" });
      this.statusCallback?.(sessionId, fileIndex, "failed", undefined, "Missing upload URL");
      return;
    }

    const storedFileData = await getFileData(sessionId, fileIndex);
    if (!storedFileData) {
      await updateSessionFileProgress(sessionId, fileIndex, { stage: "failed", error: "File data not found" });
      this.statusCallback?.(sessionId, fileIndex, "failed", undefined, "File data not found");
      return;
    }

    const data = await storedFileData.data.arrayBuffer();
    const fileType = storedFileData.fileType;
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      if (attempt > 1) {
        const delay = 1000 * Math.pow(2, attempt - 2);
        await new Promise((r) => globalThis.setTimeout(r, delay));
      }

      try {
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", fileInfo.uploadUrl!, true);
          xhr.setRequestHeader("Content-Type", fileType);
          xhr.timeout = 300_000;

          xhr.upload.onprogress = (evt) => {
            if (!evt.lengthComputable) return;
            const percent = Math.round((evt.loaded / evt.total) * 100);
            this.statusCallback?.(sessionId, fileIndex, "uploading", percent);
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else if (xhr.status >= 400 && xhr.status < 500) {
              reject(new Error(`Upload rejected (HTTP ${xhr.status}). Check R2 CORS policy.`));
            } else {
              reject(new Error(`Server error (HTTP ${xhr.status}). Retrying...`));
            }
          };

          xhr.onerror = () => reject(new Error("Network error during upload. Retrying..."));
          xhr.ontimeout = () => reject(new Error("Upload timed out. Retrying..."));

          const blob = new Blob([data], { type: fileType });
          xhr.send(blob);
        });

        await updateSessionFileProgress(sessionId, fileIndex, { stage: "done", percent: 100 });
        this.statusCallback?.(sessionId, fileIndex, "done", 100);
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const msg = lastError.message;

        if (
          msg.includes("CORS") ||
          msg.includes("Check R2 CORS") ||
          (msg.includes("HTTP 4") && !msg.includes("Retrying"))
        ) {
          await updateSessionFileProgress(sessionId, fileIndex, { stage: "failed", error: msg });
          this.statusCallback?.(sessionId, fileIndex, "failed", undefined, msg);
          throw lastError;
        }

        if (attempt <= MAX_RETRIES) {
          this.statusCallback?.(sessionId, fileIndex, "uploading", 0);
        }
      }
    }

    const errMsg = lastError?.message ?? "Upload failed after max retries";
    await updateSessionFileProgress(sessionId, fileIndex, { stage: "failed", error: errMsg });
    this.statusCallback?.(sessionId, fileIndex, "failed", undefined, errMsg);
    throw lastError ?? new Error(errMsg);
  }

  private async createSeries(sessionId: string, session: UploadSession) {
    if (session.serverSeriesId) return;

    const completedFiles = session.files
      .filter((f) => f.stage === "done")
      .sort((a, b) => a.index - b.index);

    const failedFiles = session.files.filter((f) => f.stage === "failed");
    const allFailed = failedFiles.length > 0 && completedFiles.length === 0;

    if (allFailed) {
      const names = failedFiles.map((f) => f.fileName).join(", ");
      const msg = `所有文件上传失败，无法创建剧目：${names}`;
      session.status = "failed";
      await saveUploadSession(session);
      this.broadcastChannel?.postMessage({
        type: "error",
        sessionId,
        fileIndex: -1,
        error: msg,
      });
      return;
    }

    if (completedFiles.length < session.files.length) {
      const names = failedFiles.map((f) => f.fileName).join(", ");
      const msg = `以下文件上传失败：${names}；已完成的 ${completedFiles.length} 集将正常入库。`;
      session.status = "failed";
      await saveUploadSession(session);
      this.broadcastChannel?.postMessage({
        type: "error",
        sessionId,
        fileIndex: -1,
        error: msg,
      });
    }

    const episodeUrls = completedFiles.map((f) => f.publicUrl || "");
    const episodeVideoMeta = completedFiles.map((f) => ({
      fileName: f.fileName,
      localVideoUrl: `file:///${f.fileName.replace(/\\/g, "/")}`,
      videoStreamId: undefined,
      videoPlaybackUrl: f.publicUrl || "",
      videoStatus: "ready" as const,
    }));

    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 120_000);
      const res = await fetch("/admin/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: session.formData.title,
          originalName: session.formData.originalName,
          localOrTranslated: session.formData.localOrTranslated || undefined,
          description: session.formData.description,
          tags: session.formData.tagIds,
          coverDataUrl: session.formData.coverUrl,
          episodeVideoUrls: episodeUrls,
          episodeVideoMeta,
          lockStartIndex: session.formData.lockStartIndex,
          listed: session.formData.listed,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      const json = await res.json();
      if (json.ok && json.series?.id) {
        session.serverSeriesId = json.series.id;
        session.status = "completed";
        await saveUploadSession(session);
        await deleteFileData(sessionId);
        this.broadcastChannel?.postMessage({
          type: "complete",
          sessionId,
          fileIndex: -1,
          seriesId: json.series.id,
        });
      } else {
        const errMsg = json?.error ?? json?.errorKey ?? "Create series failed";
        session.status = "failed";
        await saveUploadSession(session);
        this.broadcastChannel?.postMessage({
          type: "error",
          sessionId,
          fileIndex: -1,
          error: errMsg,
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        session.status = "failed";
        await saveUploadSession(session);
        return;
      }
      session.status = "failed";
      await saveUploadSession(session);
    }
  }

  async resumePendingUploads() {
    const sessions = await getAllUploadSessions();
    const pendingSessions = sessions.filter(
      (s) => s.status === "pending" || s.status === "uploading"
    );

    for (const session of pendingSessions) {
      const claimed = await claimSession(session.id, this.tabId);
      if (!claimed) continue;

      this.sessionCallback?.(session);
      this.addActiveSession(session.id);
      await this.processQueue(session.id);
    }
  }

  async pauseUpload(sessionId: string) {
    const session = await getUploadSession(sessionId);
    if (!session) return;

    session.status = "paused";
    await saveUploadSession(session);

    if (this.swRegistration?.active) {
      this.swRegistration.active.postMessage({
        type: "pause",
        sessionId,
        tabId: this.tabId,
      });
    }
  }

  async cancelUpload(sessionId: string) {
    if (this.swRegistration?.active) {
      this.swRegistration.active.postMessage({
        type: "cancel",
        sessionId,
        tabId: this.tabId,
      });
    }

    this.removeActiveSession(sessionId);
    await deleteUploadSession(sessionId);
    await deleteFileData(sessionId);
    this.pendingFiles.delete(sessionId);
  }

  async getSessionStatus(sessionId: string): Promise<UploadSession | undefined> {
    return getUploadSession(sessionId);
  }

  async getAllSessions(): Promise<UploadSession[]> {
    return getAllUploadSessions();
  }

  setActiveFiles(sessionId: string, files: { file: File; index: number }[]) {
    this.pendingFiles.set(sessionId, files);
  }

  destroy() {
    this.stopHeartbeat();
    for (const w of this.swUploadWaiters.values()) {
      clearTimeout(w.timeout);
    }
    this.swUploadWaiters.clear();
    this.broadcastChannel?.close();
    this.swRegistration = null;
    this.broadcastChannel = null;
    this.statusCallback = null;
    this.sessionCallback = null;
    this.activeSessionIds.clear();
    this.activeSessionId = null;
    this.pendingFiles.clear();
  }
}

export const backgroundUploadManager = new BackgroundUploadManager();
export type { UploadSession };
