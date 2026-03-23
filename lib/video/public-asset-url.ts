import type { Episode, Series } from "@/constants/mock-data";

function baseUrl(): string {
  return (process.env.S3_PUBLIC_BASE_URL ?? "").trim().replace(/\/+$/, "");
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

export function normalizeSeriesPublicUrls(series: Series): Series {
  const episodes: Episode[] = (series.episodes ?? []).map((ep) => ({
    ...ep,
    videoUrl: normalizeAssetUrl(ep.videoUrl) ?? ep.videoUrl,
    videoPlaybackUrl: normalizeAssetUrl(ep.videoPlaybackUrl),
    thumbnail: normalizeAssetUrl(ep.thumbnail) ?? ep.thumbnail
  }));
  return {
    ...series,
    cover: normalizeAssetUrl(series.cover) ?? series.cover,
    poster: normalizeAssetUrl(series.poster) ?? series.poster,
    episodes
  };
}

