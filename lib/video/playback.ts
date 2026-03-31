import type { Episode } from "@/constants/mock-data";
import { normalizeAssetUrl, proxifyR2DevMediaUrl } from "./public-asset-url";

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toPlayableUrl(raw: string): string {
  return proxifyR2DevMediaUrl(raw);
}

/** 归一化（S3 前缀等）后再套 R2 代理，与播放器候选列表一致 */
export function resolveNormalizedPlayableUrl(raw: string): string {
  const n = normalizeAssetUrl(raw.trim()) ?? raw.trim();
  return toPlayableUrl(n);
}

/**
 * 播放器回退顺序：转码地址 → 原始地址；去重保留顺序。
 */
export function buildEpisodePlaybackCandidates(episode: Episode): string[] {
  const parts: string[] = [];
  if (isNonEmpty(episode.videoPlaybackUrl)) parts.push(episode.videoPlaybackUrl);
  if (isNonEmpty(episode.videoUrl)) parts.push(episode.videoUrl);
  const urls = parts
    .map((item) => normalizeAssetUrl(item) ?? item)
    .map((item) => toPlayableUrl(item))
    .map((item) => item.trim())
    .filter(Boolean);
  return Array.from(new Set(urls));
}

/**
 * 手动转码优先策略：
 *  - videoPlaybackUrl（手动转的）排第一，无论它是 HLS 还是 MP4
 *  - videoUrl（原始 MP4）作为兜底
 * 不再做类型排序，保证"手动优先"的精确控制。
 */
export function buildMp4FirstCandidates(episode: Episode): string[] {
  return buildEpisodePlaybackCandidates(episode);
}

export function isHlsUrl(url: string): boolean {
  return /\.m3u8(\?.*)?$/i.test(url);
}

export function isMp4Url(url: string): boolean {
  return /\.mp4(\?.*)?$/i.test(url);
}

/**
 * 最终播放 URL 可能是 `/api/video/proxy?src=…`，需在解码后的 src 上判断是否为 HLS。
 */
export function playbackUrlIndicatesHls(playableUrl: string): boolean {
  const u = playableUrl.trim();
  if (!u) return false;
  if (isHlsUrl(u)) return true;
  try {
    const parsed = new URL(u, "http://localhost");
    if (!parsed.pathname.endsWith("/api/video/proxy")) return false;
    const inner = parsed.searchParams.get("src");
    if (!inner) return false;
    return isHlsUrl(decodeURIComponent(inner));
  } catch {
    return false;
  }
}

export function getEpisodePlaybackUrl(episode: Episode): string {
  const list = buildEpisodePlaybackCandidates(episode);
  return list[0] ?? "";
}
