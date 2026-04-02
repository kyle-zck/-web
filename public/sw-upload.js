const UPLOAD_TASK_CHANNEL = "bg-upload-channel";
const HEARTBEAT_INTERVAL = 30000;

// Key: `${tabId}-${sessionId}-${fileIndex}` — isolated per tab so pause/cancel only affect the right tab
const activeUploads = new Map();

let heartbeatTimer = null;

function broadcastProgress(tabId, message) {
  const clients = self.clients.matchAll({ type: "window" });
  clients.then((windowClients) => {
    windowClients.forEach((client) => {
      client.postMessage({ ...message, tabId });
    });
  });

  const channel = new BroadcastChannel(UPLOAD_TASK_CHANNEL);
  channel.postMessage({ ...message, tabId });
}

async function uploadFile(tabId, sessionId, fileIndex, uploadUrl, fileData, fileName, fileType) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const controller = new AbortController();

    const key = `${tabId}-${sessionId}-${fileIndex}`;
    activeUploads.set(key, { controller, xhr, fileData, fileName });

    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", fileType || "video/mp4");
    xhr.timeout = 300_000;

    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const percent = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
      broadcastProgress(tabId, {
        type: "progress",
        sessionId,
        fileIndex,
        percent,
      });
    };

    xhr.onload = () => {
      activeUploads.delete(key);
      if (xhr.status >= 200 && xhr.status < 300) {
        const key2 = extractKeyFromUrl(uploadUrl);
        const publicUrl = extractPublicUrl(uploadUrl);
        resolve({ publicUrl, key: key2 });
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      activeUploads.delete(key);
      reject(new Error("Network error"));
    };

    xhr.ontimeout = () => {
      activeUploads.delete(key);
      reject(new Error("Upload timeout"));
    };

    controller.signal.addEventListener("abort", () => {
      xhr.abort();
      activeUploads.delete(key);
    });

    const blob = new Blob([fileData], { type: fileType });
    xhr.send(blob);
  });
}

function extractKeyFromUrl(url) {
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

function extractPublicUrl(url) {
  try {
    const urlObj = new URL(url);
    if (
      urlObj.hostname.includes("cloudflarestorage.com") ||
      urlObj.hostname.endsWith(".r2.cloudflarestorage.com")
    ) {
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
          tabId: "sw", // identifies the source as service worker
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

self.addEventListener("message", async (event) => {
  const data = event.data;

  switch (data.type) {
    case "start":
    case "resume":
      startHeartbeat();
      if (
        data.tabId &&
        data.sessionId &&
        data.fileIndex !== undefined &&
        data.presignedUrl &&
        data.fileData
      ) {
        try {
          const result = await uploadFile(
            data.tabId,
            data.sessionId,
            data.fileIndex,
            data.presignedUrl,
            data.fileData.data,
            data.fileData.name,
            data.fileData.type
          );
          broadcastProgress(data.tabId, {
            type: "complete",
            sessionId: data.sessionId,
            fileIndex: data.fileIndex,
            publicUrl: result.publicUrl,
            key: result.key,
          });
        } catch (err) {
          broadcastProgress(data.tabId, {
            type: "error",
            sessionId: data.sessionId,
            fileIndex: data.fileIndex,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
      break;

    case "pause":
      if (data.tabId && data.sessionId) {
        activeUploads.forEach((upload, key) => {
          if (key.startsWith(`${data.tabId}-${data.sessionId}-`)) {
            upload.controller.abort();
          }
        });
      }
      break;

    case "cancel":
      if (data.tabId && data.sessionId) {
        activeUploads.forEach((upload, key) => {
          if (key.startsWith(`${data.tabId}-${data.sessionId}-`)) {
            upload.controller.abort();
          }
        });
      } else if (data.tabId) {
        // Cancel all uploads for this tab
        activeUploads.forEach((upload, key) => {
          if (key.startsWith(`${data.tabId}-`)) {
            upload.controller.abort();
          }
        });
      }
      stopHeartbeat();
      break;

    case "get-progress":
      broadcastProgress(data.tabId || null, {
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
