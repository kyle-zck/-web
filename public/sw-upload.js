const UPLOAD_TASK_CHANNEL = "bg-upload-channel";
const HEARTBEAT_INTERVAL = 30000;

interface UploadTaskMessage {
  type: "start" | "pause" | "resume" | "cancel" | "get-progress" | "upload-file";
  sessionId?: string;
  fileIndex?: number;
  fileData?: {
    name: string;
    type: string;
    size: number;
    data: ArrayBuffer;
  };
  presignedUrl?: string;
  publicUrl?: string;
  key?: string;
}

interface ProgressMessage {
  type: "progress" | "complete" | "error" | "heartbeat";
  sessionId: string;
  fileIndex?: number;
  percent?: number;
  error?: string;
  publicUrl?: string;
  key?: string;
}

const activeUploads = new Map<string, {
  controller: AbortController;
  xhr: XMLHttpRequest;
  fileData: ArrayBuffer;
  fileName: string;
}>();

let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function broadcastProgress(message: ProgressMessage) {
  const clients = self.clients.matchAll({ type: "window" });
  clients.then((windowClients) => {
    windowClients.forEach((client) => {
      client.postMessage(message);
    });
  });

  const channel = new BroadcastChannel(UPLOAD_TASK_CHANNEL);
  channel.postMessage(message);
}

async function uploadFile(
  sessionId: string,
  fileIndex: number,
  uploadUrl: string,
  fileData: ArrayBuffer,
  fileName: string,
  fileType: string
): Promise<{ publicUrl: string; key: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const controller = new AbortController();

    activeUploads.set(`${sessionId}-${fileIndex}`, {
      controller,
      xhr,
      fileData,
      fileName,
    });

    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", fileType || "video/mp4");
    xhr.timeout = 300_000;

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const percent = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
      broadcastProgress({
        type: "progress",
        sessionId,
        fileIndex,
        percent,
      });
    };

    xhr.onload = () => {
      activeUploads.delete(`${sessionId}-${fileIndex}`);
      if (xhr.status >= 200 && xhr.status < 300) {
        const key = extractKeyFromUrl(uploadUrl);
        const publicUrl = extractPublicUrl(uploadUrl);
        resolve({ publicUrl, key });
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      activeUploads.delete(`${sessionId}-${fileIndex}`);
      reject(new Error("Network error"));
    };

    xhr.ontimeout = () => {
      activeUploads.delete(`${sessionId}-${fileIndex}`);
      reject(new Error("Upload timeout"));
    };

    controller.signal.addEventListener("abort", () => {
      xhr.abort();
      activeUploads.delete(`${sessionId}-${fileIndex}`);
    });

    const blob = new Blob([fileData], { type: fileType });
    xhr.send(blob);
  });
}

function extractKeyFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    const uploadsIndex = pathParts.indexOf("uploads");
    if (uploadsIndex >= 0) {
      return pathParts.slice(uploadsIndex).join("/");
    }
    return pathParts.slice(-3).join("/");
  } catch {
    return "";
  }
}

function extractPublicUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname.includes("cloudflarestorage.com") ||
        urlObj.hostname.endsWith(".r2.cloudflarestorage.com")) {
      return `https://${urlObj.hostname}/${urlObj.pathname.slice(1)}`;
    }
    return url.split("?")[0];
  } catch {
    return url;
  }
}

function startHeartbeat() {
  if (heartbeatTimer) return;

  heartbeatTimer = setInterval(() => {
    const clients = self.clients.matchAll({ type: "window" });
    clients.then((windowClients) => {
      windowClients.forEach((client) => {
        client.postMessage({
          type: "heartbeat",
          sessionId: "system",
        });
      });
    });
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

self.addEventListener("message", async (event: ExtendableMessageEvent) => {
  const data = event.data as UploadTaskMessage;

  switch (data.type) {
    case "start":
    case "resume":
      startHeartbeat();
      if (data.sessionId && data.fileIndex !== undefined && data.presignedUrl && data.fileData) {
        try {
          const result = await uploadFile(
            data.sessionId,
            data.fileIndex,
            data.presignedUrl,
            data.fileData.data,
            data.fileData.name,
            data.fileData.type
          );
          broadcastProgress({
            type: "complete",
            sessionId: data.sessionId,
            fileIndex: data.fileIndex,
            publicUrl: result.publicUrl,
            key: result.key,
          });
        } catch (err) {
          broadcastProgress({
            type: "error",
            sessionId: data.sessionId,
            fileIndex: data.fileIndex,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
      break;

    case "pause":
      if (data.sessionId && data.fileIndex !== undefined) {
        const key = `${data.sessionId}-${data.fileIndex}`;
        const upload = activeUploads.get(key);
        if (upload) {
          upload.controller.abort();
        }
      }
      break;

    case "cancel":
      activeUploads.forEach((upload, key) => {
        if (key.startsWith(data.sessionId || "")) {
          upload.controller.abort();
        }
      });
      activeUploads.clear();
      stopHeartbeat();
      break;

    case "get-progress":
      broadcastProgress({
        type: "heartbeat",
        sessionId: data.sessionId || "unknown",
      });
      break;
  }
});

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
