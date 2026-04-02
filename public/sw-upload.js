const UPLOAD_TASK_CHANNEL = "bg-upload-channel";
const HEARTBEAT_INTERVAL = 30000;
// How often (in bytes) to emit a progress update — balances smoothness vs message overhead
const PROGRESS_CHUNK_BYTES = 256 * 1024; // 256 KB
// Minimum ms between progress updates to avoid flooding the main thread
const PROGRESS_THROTTLE_MS = 150;
// Max retries for transient network errors (not CORS)
const MAX_RETRIES = 3;
// Initial retry delay (exponential backoff)
const RETRY_DELAY_BASE_MS = 1000;
// Timeout for each upload attempt
const UPLOAD_TIMEOUT_MS = 300_000;

/**
 * Wraps a Blob as a ReadableStream that reports upload progress.
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

/**
 * Classifies an error to determine the appropriate handling strategy.
 * Returns 'cors' for CORS/preflight failures (no retry),
 * 'network' for transient network issues (retry allowed),
 * 'abort' for user-initiated cancellation (no retry, no error message),
 * 'timeout' for timeout (retry allowed),
 * 'other' for unknown errors (no retry).
 */
function classifyError(err) {
  if (!err) return "other";
  if (err.name === "AbortError") return "abort";

  const msg = err instanceof Error ? err.message : String(err);

  // CORS / preflight failures — the fetch was blocked before reaching the server
  // Common patterns: "Failed to fetch", "NetworkError", "CORS policy",
  // "Access to fetch has been blocked by CORS policy", "net::ERR_FAILED"
  const corsPatterns = [
    "Failed to fetch",
    "NetworkError",
    "CORS",
    "cors",
    "Access to",
    "net::ERR_FAILED",
    "net::ERR_CONNECTION_REFUSED",
    "net::ERR_NAME_NOT_RESOLVED",
    "net::ERR_INTERNET_DISCONNECTED",
    "net::ERR_NETWORK_CHANGED",
  ];
  if (corsPatterns.some((p) => msg.includes(p))) {
    // Distinguish "no network" from "CORS blocked by server"
    // If it looks like a real network failure, mark as network (retriable)
    const networkPatterns = [
      "net::ERR_CONNECTION_REFUSED",
      "net::ERR_NAME_NOT_RESOLVED",
      "net::ERR_INTERNET_DISCONNECTED",
      "net::ERR_NETWORK_CHANGED",
      "InternetDisconnected",
      "Network changed",
    ];
    if (networkPatterns.some((p) => msg.includes(p))) {
      return "network";
    }
    return "cors";
  }

  // Timeout
  if (msg.includes("timeout") || msg.includes("Timeout")) return "timeout";

  return "other";
}

// Key: `${tabId}-${sessionId}-${fileIndex}` — isolated per tab
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

/**
 * Attempts a single PUT upload to the presigned URL.
 * Returns the response on success, throws on failure.
 */
async function attemptUpload(controller, bodyStream, uploadUrl, fileType, timeoutMs) {
  const headers = {};
  if (fileType) {
    headers["Content-Type"] = fileType;
  }
  // NOTE: We intentionally omit "Content-Length" — the browser handles it automatically
  // for streaming bodies, and explicitly setting it can cause issues.

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Force HTTP/1.1 to avoid ALPN negotiation failures with R2.
    // HTTP/2 streaming bodies require extended CONNECT which R2's CDN doesn't support,
    // causing net::ERR_ALPN_NEGOTIATION_FAILED on some browsers/paths.
    // duplex: "half" in Chromium forces HTTP/1.1 for the streaming body.
    const res = await fetch(uploadUrl, {
      method: "PUT",
      body: bodyStream,
      // Chromium (incl. SW): streaming body requires duplex: "half"
      duplex: "half",
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function uploadFile(tabId, sessionId, fileIndex, uploadUrl, fileData, fileName, fileType) {
  const key = `${tabId}-${sessionId}-${fileIndex}`;
  const controller = new AbortController();
  activeUploads.set(key, { controller, fileData, fileName });

  const blob = new Blob([fileData], { type: fileType || "video/mp4" });
  const totalBytes = blob.size;

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAY_BASE_MS * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }

    // Re-create the stream for each attempt (blob stream can only be read once)
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
      res = await attemptUpload(controller, bodyStream, uploadUrl, fileType || "video/mp4", UPLOAD_TIMEOUT_MS);
    } catch (err) {
      activeUploads.delete(key);

      const category = classifyError(err);

      if (category === "abort") {
        throw new Error("Upload cancelled");
      }

      if (category === "cors") {
        // CORS failures are NOT retriable — always fail immediately
        throw new Error(
          "Upload blocked by CORS policy. Please ensure the R2 bucket has CORS configured: " +
          "Cloudflare Dashboard → R2 → your bucket → Settings → CORS Policy → Add Rule " +
          "with AllowedOrigin: * (or your domain), AllowedMethods: PUT, POST, HEAD, GET, " +
          "AllowedHeaders: *, MaxAge: 3600. See docs/R2-CORS-SETUP.md for details."
        );
      }

      if (category === "timeout") {
        lastError = err;
        if (attempt < MAX_RETRIES) continue;
        throw new Error(
          `Upload timed out after ${MAX_RETRIES + 1} attempts. ` +
          "Check your network connection and try again."
        );
      }

      // Transient network error — retry
      lastError = err;
      if (attempt < MAX_RETRIES) continue;

      const errMsg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Upload failed after ${MAX_RETRIES + 1} attempts: ${errMsg}`
      );
    }

    clearTimeout; // no-op reference to satisfy linter

    if (res.ok) {
      broadcastProgress(tabId, {
        type: "progress",
        sessionId,
        fileIndex,
        percent: 100,
        bytesRead: totalBytes,
        totalBytes,
      });
      const extractedKey = extractKeyFromUrl(uploadUrl);
      const publicUrl = extractPublicUrl(uploadUrl);
      activeUploads.delete(key);
      return { publicUrl, key: extractedKey };
    }

    // Non-OK response (4xx/5xx)
    const hint = await res.text().catch(() => "");

    // Retry only on 5xx server errors
    if (res.status >= 500 && attempt < MAX_RETRIES) {
      activeUploads.delete(key);
      continue;
    }

    activeUploads.delete(key);
    throw new Error(
      `Upload rejected by server (HTTP ${res.status})${hint ? ": " + hint.slice(0, 200) : ""}`
    );
  }

  // Safety fallback — should never reach here
  activeUploads.delete(key);
  throw lastError instanceof Error
    ? lastError
    : new Error("Upload failed after max retries");
}

function extractKeyFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    // videos/1234567890-my-file.mp4
    if (pathParts.includes("videos")) {
      return pathParts.slice(pathParts.indexOf("videos")).join("/");
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
      urlObj.hostname.endsWith(".r2.cloudflarestorage.com") ||
      urlObj.hostname.endsWith(".r2.dev")
    ) {
      // Strip query params (presigned signature) to get the public base URL
      return `${urlObj.origin}/${urlObj.pathname.replace(/^\//, "")}`;
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
          tabId: "sw",
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
            error: err instanceof Error ? err.message : "Upload failed",
          });
        }
      }
      break;

    case "pause":
      if (data.tabId && data.sessionId) {
        activeUploads.forEach((upload, k) => {
          if (k.startsWith(`${data.tabId}-${data.sessionId}-`)) {
            upload.controller.abort();
          }
        });
      }
      break;

    case "cancel":
      if (data.tabId && data.sessionId) {
        activeUploads.forEach((upload, k) => {
          if (k.startsWith(`${data.tabId}-${data.sessionId}-`)) {
            upload.controller.abort();
          }
        });
      } else if (data.tabId) {
        activeUploads.forEach((upload, k) => {
          if (k.startsWith(`${data.tabId}-`)) {
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
