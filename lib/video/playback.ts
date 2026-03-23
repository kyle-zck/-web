import type { Episode } from "@/constants/mock-data";

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function getEpisodePlaybackUrl(episode: Episode): string {
  if (episode.videoStatus === "ready" && isNonEmpty(episode.videoPlaybackUrl)) {
    return episode.videoPlaybackUrl;
  }
  if (isNonEmpty(episode.videoPlaybackUrl)) return episode.videoPlaybackUrl;
  return episode.videoUrl;
}

export function isHlsUrl(url: string): boolean {
  return /\.m3u8(\?.*)?$/i.test(url);
}
