type StreamCopyResult = {
  uid: string;
  readyToStream: boolean;
  status?: { state?: string };
  playback?: { hls?: string };
};

type StreamUploadResult = {
  uid: string;
  readyToStream: boolean;
  status?: { state?: string };
  playback?: { hls?: string };
};

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function accountIdAndToken() {
  return {
    accountId: env("CF_STREAM_ACCOUNT_ID"),
    token: env("CF_STREAM_API_TOKEN")
  };
}

export function hasCloudflareStreamConfig(): boolean {
  const { accountId, token } = accountIdAndToken();
  return Boolean(accountId && token);
}

function playbackFromResult(accountId: string, uid: string, hls?: string): string {
  return (
    hls || `https://customer-${accountId}.cloudflarestream.com/${uid}/manifest/video.m3u8`
  );
}

export async function tryUploadFileToStream(file: File): Promise<{
  streamId?: string;
  playbackUrl?: string;
  status?: "processing" | "ready" | "failed";
}> {
  const { accountId, token } = accountIdAndToken();
  if (!accountId || !token) return {};

  try {
    const form = new FormData();
    form.append("file", file, file.name || "video.mp4");
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form
      }
    );
    const json = (await res.json()) as {
      success?: boolean;
      result?: StreamUploadResult;
      errors?: Array<{ message?: string }>;
    };
    if (!res.ok || !json.success || !json.result?.uid) {
      console.warn(
        "[cloudflare-stream] direct upload failed:",
        json.errors?.map((e) => e.message).filter(Boolean).join("; ") || res.statusText
      );
      return {};
    }
    const streamId = json.result.uid;
    return {
      streamId,
      playbackUrl: playbackFromResult(accountId, streamId, json.result.playback?.hls),
      status: json.result.readyToStream ? "ready" : "processing"
    };
  } catch (err) {
    console.warn("[cloudflare-stream] direct upload error:", err);
    return {};
  }
}

export async function tryCreateStreamByUrl(inputUrl: string): Promise<{
  streamId?: string;
  playbackUrl?: string;
  status?: "processing" | "ready" | "failed";
}> {
  const { accountId, token } = accountIdAndToken();
  if (!accountId || !token) return {};
  if (!/^https?:\/\//i.test(inputUrl)) return {};

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/copy`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ url: inputUrl })
      }
    );
    const json = (await res.json()) as {
      success?: boolean;
      result?: StreamCopyResult;
      errors?: Array<{ message?: string }>;
    };
    if (!res.ok || !json.success || !json.result?.uid) {
      console.warn(
        "[cloudflare-stream] copy failed:",
        json.errors?.map((e) => e.message).filter(Boolean).join("; ") || res.statusText
      );
      return {};
    }
    const streamId = json.result.uid;
    const playbackUrl = playbackFromResult(accountId, streamId, json.result.playback?.hls);
    const status = json.result.readyToStream ? "ready" : "processing";
    return { streamId, playbackUrl, status };
  } catch (err) {
    console.warn("[cloudflare-stream] copy error:", err);
    return {};
  }
}

export async function getStreamPlaybackStatus(streamId: string): Promise<{
  streamId: string;
  playbackUrl?: string;
  status: "processing" | "ready" | "failed";
} | null> {
  const { accountId, token } = accountIdAndToken();
  if (!accountId || !token || !streamId) return null;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${streamId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const json = (await res.json()) as {
      success?: boolean;
      result?: StreamUploadResult;
    };
    if (!res.ok || !json.success || !json.result?.uid) return null;
    const status = json.result.readyToStream ? "ready" : "processing";
    return {
      streamId,
      playbackUrl: playbackFromResult(accountId, streamId, json.result.playback?.hls),
      status
    };
  } catch {
    return null;
  }
}
