import type { Episode, Series } from "@/constants/mock-data";

function baseUrl(): string {
  return (process.env.S3_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

/** 与 app/api/video/proxy 一致：仅允许 R2 公网域或 S3_PUBLIC_BASE_URL 对应主机 */
function isProxyableStorageHost(src: string): boolean {
  try {
    const parsed = new URL(src);
    const host = parsed.hostname.toLowerCase();
    if (host.endsWith(".r2.dev")) return true;
    const base = baseUrl();
    if (base) {
      const configuredHost = new URL(base).hostname.toLowerCase();
      if (host === configuredHost) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** 视频/HLS 走代理时用 */
function isVideoLikePathForProxy(src: string): boolean {
  return /\.(mp4|m3u8|ts|webm)(\?.*)?$/i.test(src);
}

/** 封面/海报等静态图：与视频一样，pub-*.r2.dev 直连在部分网络会 ERR_CONNECTION_CLOSED，走同源代理 */
function isImageLikePathForProxy(src: string): boolean {
  return /\.(webp|jpe?g|png|gif|avif|svg|bmp|ico)(\?.*)?$/i.test(src);
}

function isR2DefaultProxyPath(src: string): boolean {
  return isVideoLikePathForProxy(src) || isImageLikePathForProxy(src);
}

function shouldForceMediaProxy(src: string): boolean {
  return (
    process.env.NEXT_PUBLIC_MEDIA_PROXY_FORCE === "1" &&
    isProxyableStorageHost(src) &&
    isR2DefaultProxyPath(src)
  );
}

/**
 * pub-*.r2.dev 在部分网络下浏览器直连会 net::ERR_CONNECTION_CLOSED；
 * 默认让 MP4/HLS 与封面/海报图走同源 /api/video/proxy（服务端用凭证读 R2）。
 * 直连无问题的环境可设 NEXT_PUBLIC_MEDIA_DIRECT_R2=1 省 Vercel 出站流量。
 */
function shouldProxyR2DevVideoDefault(src: string): boolean {
  if (process.env.NEXT_PUBLIC_MEDIA_DIRECT_R2 === "1") return false;
  try {
    const parsed = new URL(src.trim());
    if (!parsed.hostname.toLowerCase().endsWith(".r2.dev")) return false;
    return isR2DefaultProxyPath(src);
  } catch {
    return false;
  }
}

function toProxyUrl(src: string): string {
  return `/api/video/proxy?src=${encodeURIComponent(src)}`;
}

/**
 * 代理策略：
 * - 自定义 CDN（S3_PUBLIC_BASE_URL 非 r2.dev）：视频/图默认仍直连，省边缘一跳
 * - pub-*.r2.dev 上的视频与常见图片：默认走 /api/video/proxy（避免客户端直连断连）
 * - NEXT_PUBLIC_MEDIA_PROXY_FORCE=1：在可代理主机上强制视频与图片走代理（含自定义 CDN 主机）
 * - NEXT_PUBLIC_MEDIA_DIRECT_R2=1：关闭上述 r2.dev 默认代理
 */
export function proxifyR2DevMediaUrl(raw: string): string {
  const src = raw.trim();
  if (!src) return src;

  const base = baseUrl();
  if (base) {
    if (shouldForceMediaProxy(src)) {
      return toProxyUrl(src);
    }
    if (shouldProxyR2DevVideoDefault(src)) {
      return toProxyUrl(src);
    }
    return src;
  }

  if (/^https?:\/\/[^/]+\.r2\.dev\//i.test(src)) {
    if (/[?&](?:signature|token|X-Amz-)=/i.test(src)) {
      return toProxyUrl(src);
    }
    if (shouldProxyR2DevVideoDefault(src)) {
      return toProxyUrl(src);
    }
    return src;
  }

  return src;
}

export function normalizeAssetUrl(url?: string): string | undefined {
  if (!url) return url;
  const raw = url.trim();
  if (!raw) return raw;
  if (/^(https?:)?\/\//i.test(raw)) return raw;
  if (/^(data:|blob:|file:)/i.test(raw)) return raw;

  const base = baseUrl();
  if (!base) return raw;

  // 兼容历史数据：/uploads/videos/xxx -> <S3_PUBLIC_BASE_URL>/videos/xxx
  if (raw.startsWith("/uploads/videos/")) return `${base}/videos/${raw.slice("/uploads/videos/".length)}`;
  if (raw.startsWith("/uploads/covers/")) return `${base}/covers/${raw.slice("/uploads/covers/".length)}`;
  if (raw.startsWith("/videos/")) return `${base}/videos/${raw.slice("/videos/".length)}`;
  if (raw.startsWith("/covers/")) return `${base}/covers/${raw.slice("/covers/".length)}`;
  if (raw.startsWith("/")) return `${base}${raw}`;
  return raw;
}

/** 封面/缩略图等与视频一致：相对路径补全后再走 R2 代理，避免直链在客户端加载失败 */
function normalizeImageField(url?: string): string {
  const raw = (url ?? "").trim();
  if (!raw) return "";
  const n = normalizeAssetUrl(raw) ?? raw;
  return proxifyR2DevMediaUrl(n);
}

/** 客户端兜底：锁定层等场景对单条图片 URL 做与全站一致的归一化 */
export function resolvePublicImageUrl(raw: string): string {
  return normalizeImageField(raw);
}

export function normalizeSeriesPublicUrls(series: Series): Series {
  const episodes: Episode[] = (series.episodes ?? []).map((ep) => {
    const vu = normalizeAssetUrl(ep.videoUrl) ?? ep.videoUrl;
    const vpu = normalizeAssetUrl(ep.videoPlaybackUrl);
    return {
      ...ep,
      videoUrl: vu ? proxifyR2DevMediaUrl(vu) : vu,
      videoPlaybackUrl: vpu ? proxifyR2DevMediaUrl(vpu) : ep.videoPlaybackUrl,
      thumbnail: normalizeImageField(ep.thumbnail)
    };
  });
  return {
    ...series,
    cover: normalizeImageField(series.cover),
    poster: normalizeImageField(series.poster),
    episodes
  };
}

