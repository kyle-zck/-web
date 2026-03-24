import type { Series } from "@/constants/mock-data";
import { normalizeAssetUrl } from "@/lib/video/public-asset-url";

const PLACEHOLDER = "/images/series/placeholder.svg";

function isDataImage(url: string): boolean {
  return /^data:image\//i.test(url);
}

function toBrowserReachableUrl(url: string): string {
  if (/^https?:\/\/[^/]+\.r2\.dev\/.+/i.test(url)) {
    return `/api/video/proxy?src=${encodeURIComponent(url)}`;
  }
  return url;
}

export function getSeriesArtworkChain(series: Pick<Series, "poster" | "cover">): string[] {
  const unique = new Set<string>();
  const real: string[] = [];
  const data: string[] = [];

  for (const raw of [series.poster, series.cover]) {
    const normalized = (normalizeAssetUrl(raw) ?? "").trim();
    if (!normalized || unique.has(normalized)) continue;
    const resolved = toBrowserReachableUrl(normalized);
    unique.add(resolved);
    if (isDataImage(resolved)) data.push(resolved);
    else real.push(resolved);
  }

  unique.add(PLACEHOLDER);
  return [...real, ...data, PLACEHOLDER];
}

