import type { Episode } from "@/constants/mock-data";

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toPlayableUrl(raw: string): string {
  const src = raw.trim();
  if (!src) return src;

  // R2 public links can fail on some clients/networks; proxy through our API.
  if (/^https?:\/\/[^/]+\.r2\.dev\/.+/i.test(src)) {
    return `/api/video/proxy?src=${encodeURIComponent(src)}`;
  }
  return src;
}

export function getEpisodePlaybackUrl(episode: Episode): string {
  if (episode.videoStatus === "ready" && isNonEmpty(episode.videoPlaybackUrl)) {
    return toPlayableUrl(episode.videoPlaybackUrl);
  }
  if (isNonEmpty(episode.videoPlaybackUrl)) return toPlayableUrl(episode.videoPlaybackUrl);
  return toPlayableUrl(episode.videoUrl);
}

export function isHlsUrl(url: string): boolean {
  return /\.m3u8(\?.*)?$/i.test(url);
}
