import type { Episode, Series } from "@/constants/mock-data";

function baseUrl(): string {
  return (process.env.S3_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

/**
 * 代理策略（server-side）：
 * - 已有直接可访问的公开 CDN URL → 直接返回，跳过服务端代理（极快）
 * - 仅对 .r2.dev 且不含 public token 的 URL 走服务端代理
 * - 绝对 URL 直接返回（走直连 CDN 或原始直链）
 */
export function proxifyR2DevMediaUrl(raw: string): string {
  const src = raw.trim();
  if (!src) return src;

  // 已有 S3_PUBLIC_BASE_URL：直接可访问，不走代理
  const base = baseUrl();
  if (base) return src;

  // 检测是否为公开的 Cloudflare R2 URL（不含 ?signature= 或 &token= 等鉴权参数）
  // 这类 URL 已经可公开访问，无需服务端代理，可直连 CDN 加速
  if (/^https?:\/\/[^/]+\.r2\.dev\//i.test(src)) {
    // 含鉴权参数的 R2 URL 仍走代理；其余公开 URL 直连
    if (/[?&](?:signature|token|X-Amz-)=/i.test(src)) {
      return `/api/video/proxy?src=${encodeURIComponent(src)}`;
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
  const episodes: Episode[] = (series.episodes ?? []).map((ep) => ({
    ...ep,
    videoUrl: normalizeAssetUrl(ep.videoUrl) ?? ep.videoUrl,
    videoPlaybackUrl: normalizeAssetUrl(ep.videoPlaybackUrl),
    thumbnail: normalizeImageField(ep.thumbnail)
  }));
  return {
    ...series,
    cover: normalizeImageField(series.cover),
    poster: normalizeImageField(series.poster),
    episodes
  };
}

