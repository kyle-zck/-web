import type { Episode, Series } from "@/constants/mock-data";

function baseUrl(): string {
  return (process.env.S3_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

/**
 * 代理策略：
 * - 有 S3_PUBLIC_BASE_URL → 拼接后直连 CDN，极快
 * - 无 baseUrl 时仅对 .r2.dev 走代理（兜底，不影响有配置的场景）
 * - 绝对 URL 直接返回
 */
export function proxifyR2DevMediaUrl(raw: string): string {
  const src = raw.trim();
  if (!src) return src;
  // 有 baseUrl 配置时，封面/视频优先直连 CDN，不走代理
  const base = baseUrl();
  if (base) return src;
  // 无 baseUrl 时，对 .r2.dev 兜底走代理
  if (/^https?:\/\/[^/]+\.r2\.dev\/.+/i.test(src)) {
    return `/api/video/proxy?src=${encodeURIComponent(src)}`;
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

