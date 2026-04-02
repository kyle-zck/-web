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

  /** Periodically refresh the heartbeat for any session this tab is actively processing. */
  private startHeartbeat() {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(async () => {
      if (this.activeSessionId) {
        await touchSessionHeartbeat(this.activeSessionId, this.tabId);
      }
    }, TAB_HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

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

    this.activeSessionId = sessionId;

    this.processQueue(sessionId);

    return sessionId;
  }

  private async processQueue(sessionId: string) {
    const claimed = await claimSession(sessionId, this.tabId);
    if (!claimed) return;

    const session = await getUploadSession(sessionId);
    if (!session) return;

    // Guard: if session is paused, stop scheduling new uploads
    if (session.status === "paused") return;

    session.status = "uploading";
    session.lastHeartbeat = Date.now();
    await saveUploadSession(session);
    this.activeSessionId = sessionId;

    const pendingFiles = session.files.filter(
      (f) => f.stage === "queued" || f.stage === "failed"
    );

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
        batch.map((fileInfo) => this.uploadFile(sessionId, fileInfo))
      );
    }

    const updatedSession = await getUploadSession(sessionId);
    if (updatedSession) {
      const allDone = updatedSession.files.every((f) => f.stage === "done");
      const anyFailed = updatedSession.files.some((f) => f.stage === "failed");

      if (allDone) {
        updatedSession.status = "completed";
        await saveUploadSession(updatedSession);
        await this.createSeries(sessionId, updatedSession);
      } else if (anyFailed) {
        updatedSession.status = "failed";
        await saveUploadSession(updatedSession);
      }
    }
  }

  private async uploadFile(sessionId: string, fileInfo: UploadSession["files"][number]) {
    // Guard: skip if session was paused by the time we reach this file
    const session = await getUploadSession(sessionId);
    if (!session || session.status === "paused") return;

    this.statusCallback?.(sessionId, fileInfo.index, "presign", 0);

    // Build the file list for batch presign: current file + up to PRESIGN_BATCH_SIZE-1 queued peers
    const queuedFiles = session.files
      .filter((f) => f.stage === "queued" || f.stage === "failed")
      .sort((a, b) => a.index - b.index);

    // Take enough to cover this file; cap at batch size so we don't over-fetch presigned URLs
    const batchSize = Math.min(queuedFiles.length, PRESIGN_BATCH_SIZE);
    const peerFiles = queuedFiles.slice(0, batchSize);
    const peerMap = new Map(peerFiles.map((f) => [f.index, f]));

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

      if (!presignRes.ok) {
        throw new Error("Presign batch failed");
      }

      const presignJson = (await presignRes.json()) as {
        ok?: boolean;
        items?: Array<{ fileName: string; key: string; uploadUrl: string; publicUrl?: string }>;
      };

      if (!presignJson.ok || !Array.isArray(presignJson.items) || presignJson.items.length === 0) {
        throw new Error("Invalid presign batch response");
      }

      // Map results back — match by fileName so re-ordered peers still resolve correctly
      for (const item of presignJson.items) {
        const match = peerFiles.find((f) => f.fileName === item.fileName);
        if (match) {
          match.uploadUrl = item.uploadUrl;
          match.publicUrl = item.publicUrl;
          match.key = item.key;
        }
      }

      // Inject the already-resolved presigned URL for the file we were called with
      if (peerMap.has(fileInfo.index)) {
        const resolved = peerMap.get(fileInfo.index)!;
        fileInfo.uploadUrl = resolved.uploadUrl;
        fileInfo.key = resolved.key;
        fileInfo.publicUrl = resolved.publicUrl;
      }

      await this.updateFileProgress(sessionId, fileInfo);
      this.statusCallback?.(sessionId, fileInfo.index, "uploading", 1);

      await this.sendToServiceWorker(sessionId, fileInfo);

    } catch (err) {
      fileInfo.retryCount += 1;
      if (fileInfo.retryCount < MAX_RETRIES) {
        await this.updateFileProgress(sessionId, fileInfo);
        const s2 = await getUploadSession(sessionId);
        const fresh = s2?.files.find((f) => f.index === fileInfo.index);
        if (!fresh || s2?.status === "paused") return;
        fresh.stage = "queued";
        await this.updateFileProgress(sessionId, fresh);
        setTimeout(() => this.uploadFile(sessionId, fresh), 1000 * fileInfo.retryCount);
      } else {
        fileInfo.stage = "failed";
        fileInfo.error = err instanceof Error ? err.message : "Upload failed";
        await this.updateFileProgress(sessionId, fileInfo);
        this.statusCallback?.(
          sessionId,
          fileInfo.index,
          "failed",
          undefined,
          fileInfo.error
        );
      }
    }
  }

  private async sendToServiceWorker(
    sessionId: string,
    fileInfo: UploadSession["files"][number]
  ) {
    const session = await getUploadSession(sessionId);
    if (!session) return;

    let fileData: File | null = null;
    let fileName = fileInfo.fileName;
    let fileType = fileInfo.fileType;

    const storedFileData = await getFileData(sessionId, fileInfo.index);
    if (storedFileData) {
      fileData = new File([storedFileData.data], storedFileData.fileName, {
        type: storedFileData.fileType,
      });
      fileName = storedFileData.fileName;
      fileType = storedFileData.fileType;
    } else {
      const formFiles = this.pendingFiles.get(sessionId)?.find((f) => f.index === fileInfo.index);
      if (formFiles) {
        fileData = formFiles.file;
        fileName = formFiles.file.name;
        fileType = formFiles.file.type;
      }
    }

    if (!fileData) {
      fileInfo.stage = "failed";
      await this.updateFileProgress(sessionId, fileInfo);
      this.statusCallback?.(sessionId, fileInfo.index, "failed", undefined, "File data not found");
      throw new Error("File data not found");
    }

    try {
      const arrayBuffer = await fileData.arrayBuffer();

      if (this.swRegistration?.active) {
        const wk = BackgroundUploadManager.swWaitKey(sessionId, fileInfo.index);
        const waitPromise = new Promise<{ publicUrl: string; key: string }>((resolve, reject) => {
          const timeout = globalThis.setTimeout(() => {
            this.swUploadWaiters.delete(wk);
            reject(new Error("Upload timeout"));
          }, 600_000);
          this.swUploadWaiters.set(wk, { resolve, reject, timeout });
        });

        this.swRegistration.active.postMessage({
          type: "start",
          sessionId,
          fileIndex: fileInfo.index,
          tabId: this.tabId,
          fileData: {
            name: fileName,
            type: fileType,
            size: fileData.size,
            data: arrayBuffer,
          },
          presignedUrl: fileInfo.uploadUrl,
        });

        const result = await waitPromise;
        fileInfo.publicUrl = result.publicUrl || fileInfo.publicUrl;
        fileInfo.key = result.key || fileInfo.key;
        fileInfo.stage = "done";
        fileInfo.percent = 100;
        // IndexedDB already updated in onSwUploadComplete
      } else {
        await this.uploadDirect(sessionId, fileInfo, arrayBuffer, fileType);
      }
    } catch (err) {
      const wk = BackgroundUploadManager.swWaitKey(sessionId, fileInfo.index);
      if (this.swUploadWaiters.has(wk)) {
        clearTimeout(this.swUploadWaiters.get(wk)!.timeout);
        this.swUploadWaiters.delete(wk);
        fileInfo.stage = "failed";
        await this.updateFileProgress(sessionId, fileInfo);
        this.statusCallback?.(
          sessionId,
          fileInfo.index,
          "failed",
          undefined,
          err instanceof Error ? err.message : "Upload failed"
        );
        return;
      }
      if (this.swRegistration?.active) {
        const latest = await getUploadSession(sessionId);
        const f = latest?.files.find((x) => x.index === fileInfo.index);
        if (f?.stage === "failed" || f?.stage === "done") {
          return;
        }
        fileInfo.stage = "failed";
        await this.updateFileProgress(sessionId, fileInfo);
        this.statusCallback?.(
          sessionId,
          fileInfo.index,
          "failed",
          undefined,
          err instanceof Error ? err.message : "Upload failed"
        );
        return;
      }
      fileInfo.stage = "failed";
      await this.updateFileProgress(sessionId, fileInfo);
      this.statusCallback?.(
        sessionId,
        fileInfo.index,
        "failed",
        undefined,
        err instanceof Error ? err.message : "Failed to read file"
      );
    }
  }

  private async uploadDirect(
    sessionId: string,
    fileInfo: UploadSession["files"][number],
    data: ArrayBuffer,
    fileType: string
  ): Promise<void> {
    if (!fileInfo.uploadUrl) return;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", fileInfo.uploadUrl!, true);
      xhr.setRequestHeader("Content-Type", fileType);
      xhr.timeout = 300_000;

      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return;
        const percent = Math.round((evt.loaded / evt.total) * 100);
        this.statusCallback?.(sessionId, fileInfo.index, "uploading", percent);
      };

      xhr.onload = () => {
        void (async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            this.statusCallback?.(sessionId, fileInfo.index, "done", 100);
            fileInfo.stage = "done";
            fileInfo.percent = 100;
            await this.updateFileProgress(sessionId, fileInfo);
            resolve();
          } else {
            this.statusCallback?.(sessionId, fileInfo.index, "failed", undefined, `HTTP ${xhr.status}`);
            fileInfo.stage = "failed";
            await this.updateFileProgress(sessionId, fileInfo);
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        })();
      };

      xhr.onerror = () => {
        void (async () => {
          this.statusCallback?.(sessionId, fileInfo.index, "failed", undefined, "Network error");
          fileInfo.stage = "failed";
          await this.updateFileProgress(sessionId, fileInfo);
          reject(new Error("Network error"));
        })();
      };

      xhr.ontimeout = () => {
        void (async () => {
          this.statusCallback?.(sessionId, fileInfo.index, "failed", undefined, "Timeout");
          fileInfo.stage = "failed";
          await this.updateFileProgress(sessionId, fileInfo);
          reject(new Error("Timeout"));
        })();
      };

      const blob = new Blob([data], { type: fileType });
      xhr.send(blob);
    });
  }

  private async updateFileProgress(
    sessionId: string,
    fileInfo: UploadSession["files"][number]
  ) {
    const session = await getUploadSession(sessionId);
    if (!session) return;

    const idx = session.files.findIndex((f) => f.index === fileInfo.index);
    if (idx >= 0) {
      // Shallow merge so we never accidentally lose fields not present in fileInfo
      session.files[idx] = { ...session.files[idx], ...fileInfo };
      await saveUploadSession(session);
    }
  }

  private async createSeries(sessionId: string, session: UploadSession) {
    if (session.serverSeriesId) return;

    const completedFiles = session.files
      .filter((f) => f.stage === "done")
      .sort((a, b) => a.index - b.index);

    if (completedFiles.length === 0) {
      session.status = "failed";
      await saveUploadSession(session);
      return;
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
      });

      const json = await res.json();
      if (json.ok) {
        session.serverSeriesId = json.id;
        session.status = "completed";
        await saveUploadSession(session);
        await deleteFileData(sessionId);
      } else {
        session.status = "failed";
        await saveUploadSession(session);
      }
    } catch {
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
      this.activeSessionId = session.id;
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
    this.activeSessionId = null;
    this.pendingFiles.clear();
  }
}

export const backgroundUploadManager = new BackgroundUploadManager();
export type { UploadSession };
