import type { Episode, Series } from "@/constants/mock-data";

export type EpisodeVideoMode = "hls" | "mp4" | "processing" | "failed";
export type SeriesVideoMode = "hls" | "mp4" | "mixed" | "processing";

function isHlsUrl(url: string): boolean {
  return /\.m3u8(\?.*)?$/i.test(url);
}

export function getEpisodeEffectivePlaybackUrl(ep: Episode): string {
  if (ep.videoStatus === "ready" && ep.videoPlaybackUrl?.trim()) return ep.videoPlaybackUrl;
  if (ep.videoPlaybackUrl?.trim()) return ep.videoPlaybackUrl;
  return ep.videoUrl;
}

export function getEpisodeVideoMode(ep: Episode): EpisodeVideoMode {
  if (ep.videoStatus === "processing") return "processing";
  if (ep.videoStatus === "failed") return "failed";
  return isHlsUrl(getEpisodeEffectivePlaybackUrl(ep)) ? "hls" : "mp4";
}

export function getSeriesVideoMode(series: Series): SeriesVideoMode {
  const episodes = series.episodes ?? [];
  if (episodes.length === 0) return "mp4";

  const modes = episodes.map(getEpisodeVideoMode);
  if (modes.some((m) => m === "processing")) return "processing";

  const hlsCount = modes.filter((m) => m === "hls").length;
  const mp4Count = modes.filter((m) => m === "mp4").length;
  if (hlsCount === episodes.length) return "hls";
  if (mp4Count === episodes.length) return "mp4";
  return "mixed";
}
