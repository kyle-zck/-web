const UPLOAD_TASK_CHANNEL = "bg-upload-channel";
const HEARTBEAT_INTERVAL = 30000;
// How often (in bytes) to emit a progress update — balances smoothness vs message overhead
const PROGRESS_CHUNK_BYTES = 256 * 1024; // 256 KB
// Minimum ms between progress broadcasts to avoid flooding the main thread
const PROGRESS_THROTTLE_MS = 150;

/**
 * Wraps a Blob as a ReadableStream that reports upload progress via TransformStream.
 * Each chunk flows through immediately; progress broadcasts are throttled.
 * The upstream AbortController aborts the entire stream (including the in-flight fetch body).
 */
function createProgressStream(blob, { onProgress, totalBytes, throttleMs = PROGRESS_THROTTLE_MS }) {
  let bytesRead = 0;
  let lastBroadcastAt = 0;
  const blobReader = blob.stream().getReader();

  const transport = new ReadableStream({
    async pull(controller) {
      const { done, value } = await blobReader.read();
      if (done) {
        controller.close();
        return;
      }

      // Report progress every PROGRESS_CHUNK_BYTES or on the last chunk
      bytesRead += value.byteLength;
      const now = Date.now();
      const isLast = bytesRead >= totalBytes;
      if (isLast || now - lastBroadcastAt >= throttleMs) {
        const percent = Math.min(100, Math.round((bytesRead / totalBytes) * 100));
        onProgress(bytesRead, totalBytes, percent);
        lastBroadcastAt = now;
      }

      controller.enqueue(value);
    },

    cancel() {
      blobReader.cancel();
    },
  });

  return transport;
}

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
  const MAX_RETRIES = 3;
  const RETRY_DELAY_BASE_MS = 1000;

  const controller = new AbortController();
  const key = `${tabId}-${sessionId}-${fileIndex}`;
  activeUploads.set(key, { controller, fileData, fileName });

  const blob = new Blob([fileData], { type: fileType || "video/mp4" });
  const totalBytes = blob.size;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential backoff before retrying
      const delay = RETRY_DELAY_BASE_MS * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }

    // AbortController drives timeout — clears itself on success/error/abort
    const timeoutMs = 300_000;
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    // Create the progress-aware stream; abort signal stops the fetch body mid-flight
    const bodyStream = createProgressStream(blob, {
      totalBytes,
      onProgress: (bytesRead, _total, percent) => {
        broadcastProgress(tabId, {
          type: "progress",
          sessionId,
          fileIndex,
          percent,
          bytesRead,
          totalBytes,
        });
      },
    });

    let res;
    try {
      res = await fetch(uploadUrl, {
        method: "PUT",
        body: bodyStream,
        // Chromium (incl. SW): ReadableStream body requires duplex — otherwise throws
        // "The `duplex` member must be specified for a request with a streaming body"
        duplex: "half",
        headers: {
          "Content-Type": fileType || "video/mp4",
          "Content-Length": String(totalBytes),
        },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err && err.name === "AbortError") {
        throw new Error("Upload aborted or timed out");
      }
      // Network error — retry if attempts remain
      if (attempt < MAX_RETRIES) continue;
      activeUploads.delete(key);
      throw err instanceof Error ? err : new Error(String(err));
    }

    clearTimeout(timeoutId);

    if (res.ok) {
      broadcastProgress(tabId, {
        type: "progress",
        sessionId,
        fileIndex,
        percent: 100,
        bytesRead: totalBytes,
        totalBytes,
      });
      const key2 = extractKeyFromUrl(uploadUrl);
      const publicUrl = extractPublicUrl(uploadUrl);
      activeUploads.delete(key);
      return { publicUrl, key: key2 };
    }

    const hint = await res.text().catch(() => "");
    // Non-OK response (4xx/5xx) — retry on 5xx server errors only
    if (res.status >= 500 && attempt < MAX_RETRIES) {
      activeUploads.delete(key);
      continue;
    }
    activeUploads.delete(key);
    throw new Error(
      `Upload failed: ${res.status}${hint ? ` ${hint.slice(0, 200)}` : ""}`
    );
  }

  // Should never reach here, but safety fallback
  activeUploads.delete(key);
  throw new Error("Upload failed after max retries");
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
