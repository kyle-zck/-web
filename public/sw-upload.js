const UPLOAD_TASK_CHANNEL = "bg-upload-channel";
const HEARTBEAT_INTERVAL = 30000;
// Max retries for transient network errors (not CORS)
const MAX_RETRIES = 3;
// Initial retry delay (exponential backoff)
const RETRY_DELAY_BASE_MS = 1000;
// Timeout for each upload attempt
const UPLOAD_TIMEOUT_MS = 300_000;

/**
 * Classifies an error to determine the appropriate handling strategy.
 * Returns 'cors' for CORS/preflight failures (no retry),
 * 'network' for transient network issues (retry allowed),
 * 'abort' for user-initiated cancellation (no retry, no error message),
 * 'timeout' for timeout (retry allowed),
 * 'http' for HTTP 4xx/5xx responses (retry 5xx only),
 * 'other' for unknown errors (no retry).
 */
function classifyError(err) {
  if (!err) return "other";
  if (err.name === "AbortError") return "abort";

  const msg = err instanceof Error ? err.message : String(err);

  // CORS / preflight failures — the browser was blocked before reaching the server
  const corsPatterns = [
    "has been blocked by CORS policy",
    "CORS request blocked",
    "origin is not allowed by",
    "Not allowed by Access-Control-Allow",
    "No 'Access-Control-Allow-Origin'",
    "Response for preflight",
    "has been blocked by",
    "target IP address space",
    "IP address space",
  ];
  if (corsPatterns.some((p) => msg.includes(p))) {
    return "cors";
  }

  // HTTP error responses (e.g. "HTTP 403", "HTTP 500")
  if (/^HTTP \d{3}/.test(msg)) {
    const status = parseInt(msg.split(" ")[1], 10);
    return status >= 500 ? "http" : "cors";
  }

  // Transient network errors — retry allowed.
  // Covers: net::ERR_NETWORK_CHANGED, ERR_INTERNET_DISCONNECTED,
  // ERR_CONNECTION_RESET, ERR_ALPN_NEGOTIATION_FAILED, Failed to fetch,
  // NetworkError, Network error, SSL_PROTOCOL_ERROR, TLS_VERSION_INCOMPATIBLE, etc.
  const networkPatterns = [
    "Failed to fetch",
    "NetworkError",
    "Network error",
    "timeout",
    "Timeout",
    "ERR_NETWORK_CHANGED",
    "ERR_INTERNET_DISCONNECTED",
    "ERR_CONNECTION_RESET",
    "ERR_ALPN_NEGOTIATION_FAILED",
    "ERR_TIMED_OUT",
    "SSL_PROTOCOL_ERROR",
    "TLS_VERSION_INCOMPATIBLE",
    "CERT_AUTHORITY_INVALID",
    "net::ERR",
  ];
  if (networkPatterns.some((p) => msg.includes(p))) {
    return "network";
  }

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
 * Uploads a Blob via fetch to the presigned URL.
 * Uses a plain ArrayBuffer body (not a ReadableStream) to avoid HTTP/2 ALPN
 * negotiation failures that streaming PUT bodies trigger with R2's CDN.
 * Reports progress via onProgress callback; aborts via AbortController.
 * Returns the response on success, throws on failure.
 */
async function fetchUpload(blob, uploadUrl, fileType, timeoutMs, controller, onProgress) {
  const headers = { "Content-Type": fileType || "video/mp4" };

  // Use XMLHttpRequest for progress reporting + HTTP/1.1 (available in main thread
  // and dedicated workers — we fall back to fetch-only when XHR is unavailable).
  if (typeof XMLHttpRequest !== "undefined") {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const timeoutId = setTimeout(() => {
        xhr.abort();
        controller.abort();
      }, timeoutMs);

      xhr.open("PUT", uploadUrl, true);
      xhr.setRequestHeader("Content-Type", fileType || "video/mp4");

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          onProgress(evt.loaded, evt.total, Math.round((evt.loaded / evt.total) * 100));
        }
      };

      xhr.onload = () => {
        clearTimeout(timeoutId);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr);
        } else {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      };

      xhr.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error("Network error during upload"));
      };

      xhr.ontimeout = () => {
        clearTimeout(timeoutId);
        reject(new Error("Upload timed out"));
      };

      controller.signal.addEventListener("abort", () => xhr.abort(), { once: true });

      xhr.send(blob);
    });
  }

  // Service Worker fallback: fetch with plain ArrayBuffer (no streaming, avoids ALPN).
  // Progress is estimated since fetch doesn't expose upload progress.
  const arrayBuffer = await blob.arrayBuffer();
  onProgress(0, arrayBuffer.byteLength, 0);

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      body: arrayBuffer,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    onProgress(arrayBuffer.byteLength, arrayBuffer.byteLength, 100);
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

    try {
      await fetchUpload(blob, uploadUrl, fileType || "video/mp4", UPLOAD_TIMEOUT_MS, controller, (bytesRead, _total, percent) => {
        broadcastProgress(tabId, {
          type: "progress",
          sessionId,
          fileIndex,
          percent,
          bytesRead,
          totalBytes,
        });
      });
    } catch (err) {
      const category = classifyError(err);

      if (category === "abort") {
        throw new Error("Upload cancelled");
      }

      if (category === "cors") {
        throw new Error(
          "Upload blocked by CORS policy. Please ensure the R2 bucket has CORS configured: " +
          "Cloudflare Dashboard → R2 → your bucket → Settings → CORS Policy → Add Rule " +
          "with AllowedOrigin: * (or your domain), AllowedMethods: PUT, POST, HEAD, GET, " +
          "AllowedHeaders: *, MaxAge: 3600. See docs/R2-CORS-SETUP.md for details."
        );
      }

      if (category === "http") {
        // 5xx — retry
        lastError = err;
        if (attempt < MAX_RETRIES) continue;
        throw new Error(
          `Upload failed after ${MAX_RETRIES + 1} attempts: ${err instanceof Error ? err.message : String(err)}`
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

    // xhrUpload resolved — upload succeeded
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
