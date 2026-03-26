import type { Series } from "@/constants/mock-data";
import { normalizeAssetUrl, proxifyR2DevMediaUrl } from "@/lib/video/public-asset-url";

const PLACEHOLDER = "/images/series/placeholder.svg";

function isDataImage(url: string): boolean {
  return /^data:image\//i.test(url);
}

export function getSeriesArtworkChain(series: Pick<Series, "poster" | "cover">): string[] {
  const seenNormalized = new Set<string>();
  const real: string[] = [];
  const data: string[] = [];

  for (const raw of [series.poster, series.cover]) {
    const normalized = (normalizeAssetUrl(raw) ?? "").trim();
    if (!normalized || seenNormalized.has(normalized)) continue;
    seenNormalized.add(normalized);
    const resolved = proxifyR2DevMediaUrl(normalized);
    if (isDataImage(resolved)) data.push(resolved);
    else real.push(resolved);
  }

  return [...real, ...data, PLACEHOLDER];
}
