/**
 * R2 经 /api/video/proxy 时，用绝对 URL + next.config images.remotePatterns
 * 以便走 next/image 压缩与响应式尺寸（避免整页下载 680px 海报却只显示 120px）。
 */
export function resolvePosterSrcForOptimizer(src: string): string {
  if (!src.startsWith("/api/video/proxy")) return src;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (!base) return src;
  return `${base}${src}`;
}
