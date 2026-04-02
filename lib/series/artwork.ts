import type { Series } from "@/constants/mock-data";
import { normalizeAssetUrl, proxifyR2DevMediaUrl } from "@/lib/video/public-asset-url";

const PLACEHOLDER = "/images/series/placeholder.svg";

function isDataImage(url: string): boolean {
  return /^data:image\//i.test(url);
}

function isExternalCdnUrl(url: string): boolean {
  const src = url.trim();
  if (!src || src.startsWith("/")) return false;
  if (/^\/api\/video\/proxy\?/i.test(src)) return false;
  // 仅对外部跨域 URL 追加代理兜底；同源 / 相对路径 / 代理 URL 不追加
  try {
    const u = new URL(src);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return false;
    // 任何跨域 HTTPS URL（R2.dev、自定义 CDN）都需要兜底
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
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

  // 直连全部失败兜底：代理路径放末尾（next/image onError 自动切到下一项）
  const proxyFallback =
    real.length > 0 && isExternalCdnUrl(real[0])
      ? `/api/video/proxy?src=${encodeURIComponent(real[0])}`
      : null;

  return [...real, ...(proxyFallback ? [proxyFallback] : []), ...data, PLACEHOLDER];
}
