import type { Episode, Series } from "@/constants/mock-data";

function baseUrl(): string {
  return (process.env.S3_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

/** 仅允许 R2 公网域或 S3_PUBLIC_BASE_URL 对应主机 */
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

function shouldForceMediaProxy(src: string): boolean {
  return (
    process.env.NEXT_PUBLIC_MEDIA_PROXY_FORCE === "1" &&
    isProxyableStorageHost(src)
  );
}

function toProxyUrl(src: string): string {
  return `/api/video/proxy?src=${encodeURIComponent(src)}`;
}

/**
 * 直连策略（默认）：
 * - 图片（webp/jpg/png/gif/avif）：始终直连，不走代理
 * - 视频（mp4/m3u8/ts/webm）：始终直连，不走代理
 *
 * 代理仅在以下情况使用：
 * - 1. 预签名 URL（含有 signature/token/X-Amz- 参数）必须走代理
 * - 2. NEXT_PUBLIC_MEDIA_PROXY_FORCE=1：强制所有媒体走代理（含自定义 CDN）
 * - 3. 组件层面兜底：直连加载失败时自动切换到 /api/video/proxy
 *
 * 为什么不默认走代理：
 * - 代理多一跳 Vercel，增加延迟和资源占用
 * - 直连走 Cloudflare 边缘网络，延迟更低
 * - 图片走 next/image 直连可吃到内置优化（webp/avif 转换、缓存）
 */
export function proxifyR2DevMediaUrl(raw: string): string {
  const src = raw.trim();
  if (!src) return src;

  const base = baseUrl();
  if (base) {
    // 预签名 URL 必须走代理
    if (/[?&](?:signature|token|X-Amz-)=/i.test(src)) {
      return toProxyUrl(src);
    }
    // 强制代理开关
    if (shouldForceMediaProxy(src)) {
      return toProxyUrl(src);
    }
    // 其余全部直连
    return src;
  }

  // 无 base 配置时，仅预签名 URL 走代理
  if (/^https?:\/\/[^/]+\.r2\.dev\//i.test(src)) {
    if (/[?&](?:signature|token|X-Amz-)=/i.test(src)) {
      return toProxyUrl(src);
    }
    return src;
  }

  return src;
}

export function normalizeAssetUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const raw = url.trim();
  if (!raw) return undefined;
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

/** 封面/缩略图等：相对路径补全后直连，组件层做兜底 */
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
    const vu = normalizeAssetUrl(ep.videoUrl);
    const vpu = normalizeAssetUrl(ep.videoPlaybackUrl);
    return {
      ...ep,
      videoUrl: vu ? proxifyR2DevMediaUrl(vu) : (vu ?? ep.videoUrl ?? ""),
      videoPlaybackUrl: vpu ? proxifyR2DevMediaUrl(vpu) : (vpu ?? ep.videoPlaybackUrl ?? ""),
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
