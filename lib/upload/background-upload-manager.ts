import {
  saveUploadSession,
  getUploadSession,
  getAllUploadSessions,
  deleteUploadSession,
  saveFileData,
  getFileData,
  deleteFileData,
  generateSessionId,
  type UploadSession,
} from "./background-upload-db";

const SW_FILENAME = "/sw-upload.js";
const CHANNEL_NAME = "bg-upload-channel";
const MAX_CONCURRENT_UPLOADS = 5;
const MAX_RETRIES = 3;

type UploadStatusCallback = (
  sessionId: string,
  fileIndex: number,
  status: "queued" | "presign" | "uploading" | "completing" | "done" | "failed",
  percent?: number,
  error?: string
) => void;

type SessionStatusCallback = (session: UploadSession) => void;

class BackgroundUploadManager {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private statusCallback: UploadStatusCallback | null = null;
  private sessionCallback: SessionStatusCallback | null = null;
  private activeSessionId: string | null = null;
  private pendingFiles: Map<string, { file: File; index: number }[]> = new Map();

  async initialize(): Promise<boolean> {
    if (typeof window === "undefined") return false;

    if (!("serviceWorker" in navigator)) {
      console.warn("Service Worker not supported");
      return false;
    }

    try {
      this.swRegistration = await navigator.serviceWorker.register(SW_FILENAME, {
        scope: "/",
      });

      this.broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
      this.broadcastChannel.onmessage = this.handleServiceWorkerMessage.bind(this);

      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "get-progress" });
      }

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

    if (data.type === "progress" && data.sessionId && data.fileIndex !== undefined) {
      this.statusCallback?.(data.sessionId, data.fileIndex, "uploading", data.percent);
    } else if (data.type === "complete" && data.sessionId && data.fileIndex !== undefined) {
      this.statusCallback?.(data.sessionId, data.fileIndex, "done", 100);
    } else if (data.type === "error" && data.sessionId && data.fileIndex !== undefined) {
      this.statusCallback?.(data.sessionId, data.fileIndex, "failed", undefined, data.error);
    } else if (data.type === "heartbeat") {
      this.checkPendingSessions();
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

  async startUpload(
    formData: UploadSession["formData"],
    files: { file: File; index: number }[]
  ): Promise<string> {
    const sessionId = generateSessionId();

    const session: UploadSession = {
      id: sessionId,
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
    const session = await getUploadSession(sessionId);
    if (!session) return;

    session.status = "uploading";
    await saveUploadSession(session);

    const pendingFiles = session.files.filter(
      (f) => f.stage === "queued" || f.stage === "failed"
    );

    const batches: typeof pendingFiles[] = [];
    for (let i = 0; i < pendingFiles.length; i += MAX_CONCURRENT_UPLOADS) {
      batches.push(pendingFiles.slice(i, i + MAX_CONCURRENT_UPLOADS));
    }

    for (const batch of batches) {
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
    this.statusCallback?.(sessionId, fileInfo.index, "presign", 0);

    try {
      const presignRes = await fetch("/admin/api/upload/video/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: fileInfo.fileName,
          contentType: fileInfo.fileType,
        }),
      });

      if (!presignRes.ok) {
        throw new Error("Presign failed");
      }

      const presignJson = await presignRes.json();
      if (!presignJson.ok || !presignJson.uploadUrl) {
        throw new Error("Invalid presign response");
      }

      fileInfo.uploadUrl = presignJson.uploadUrl;
      fileInfo.key = presignJson.key;
      await this.updateFileProgress(sessionId, fileInfo);

      this.statusCallback?.(sessionId, fileInfo.index, "uploading", 1);

      await this.sendToServiceWorker(sessionId, fileInfo);

    } catch (err) {
      fileInfo.retryCount += 1;
      if (fileInfo.retryCount < MAX_RETRIES) {
        fileInfo.stage = "queued";
        await this.updateFileProgress(sessionId, fileInfo);
        setTimeout(() => this.uploadFile(sessionId, fileInfo), 1000 * fileInfo.retryCount);
      } else {
        this.statusCallback?.(
          sessionId,
          fileInfo.index,
          "failed",
          undefined,
          err instanceof Error ? err.message : "Upload failed"
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
      this.statusCallback?.(sessionId, fileInfo.index, "failed", undefined, "File data not found");
      return;
    }

    try {
      const arrayBuffer = await fileData.arrayBuffer();

      if (this.swRegistration?.active) {
        this.swRegistration.active.postMessage({
          type: "start",
          sessionId,
          fileIndex: fileInfo.index,
          fileData: {
            name: fileName,
            type: fileType,
            size: formFiles.file.size,
            data: arrayBuffer,
          },
          presignedUrl: fileInfo.uploadUrl,
        });
      } else {
        await this.uploadDirect(sessionId, fileInfo, arrayBuffer, formFiles.file.type);
      }
    } catch (err) {
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
      xhr.open("PUT", fileInfo.uploadUrl, true);
      xhr.setRequestHeader("Content-Type", fileType);
      xhr.timeout = 300_000;

      xhr.upload.onprogress = (evt) => {
        if (!evt.lengthComputable) return;
        const percent = Math.round((evt.loaded / evt.total) * 100);
        this.statusCallback?.(sessionId, fileInfo.index, "uploading", percent);
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          this.statusCallback?.(sessionId, fileInfo.index, "done", 100);
          resolve();
        } else {
          this.statusCallback?.(sessionId, fileInfo.index, "failed", undefined, `HTTP ${xhr.status}`);
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        this.statusCallback?.(sessionId, fileInfo.index, "failed", undefined, "Network error");
        reject(new Error("Network error"));
      };

      xhr.ontimeout = () => {
        this.statusCallback?.(sessionId, fileInfo.index, "failed", undefined, "Timeout");
        reject(new Error("Timeout"));
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
      session.files[idx] = { ...session.files[idx], ...fileInfo };
      await saveUploadSession(session);
    }
  }

  private async createSeries(sessionId: string, session: UploadSession) {
    const completedFiles = session.files
      .filter((f) => f.stage === "done")
      .sort((a, b) => a.index - b.index);

    if (completedFiles.length === 0) return;

    const episodeUrls = completedFiles.map((f) => f.publicUrl || "");
    const episodeVideoMeta = completedFiles.map((f, idx) => ({
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

    await Promise.all(
      pendingSessions.map(async (session) => {
        this.sessionCallback?.(session);
        this.activeSessionId = session.id;
        await this.processQueue(session.id);
      })
    );
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
      });
    }
  }

  async cancelUpload(sessionId: string) {
    if (this.swRegistration?.active) {
      this.swRegistration.active.postMessage({
        type: "cancel",
        sessionId,
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
