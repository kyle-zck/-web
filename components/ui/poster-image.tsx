"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { resolvePosterSrcForOptimizer } from "@/lib/image/poster-src";

function srcNeedsUnoptimized(src: string): boolean {
  return /^(data:|blob:|file:)/i.test(src) || /\.svg(\?|$)/i.test(src);
}

export type PosterImageProps = {
  chain: string[];
  alt: string;
  /** 响应式宽度提示，供 next/image 生成 srcset */
  sizes: string;
  className?: string;
  /** LCP：首张海报可设 true */
  priority?: boolean;
  /** 1–100，默认 LCP 略高、其余略压体积（Lighthouse「改进图片传送」） */
  quality?: number;
};

/**
 * 剧目海报：next/image 压缩/WebP(Avif) + srcset，保留封面链 fallback（与原先 onError 行为一致）
 */
export function PosterImage({ chain, alt, sizes, className, priority, quality }: PosterImageProps) {
  const [index, setIndex] = useState(0);
  const list = chain.length > 0 ? chain : [""];
  const src = list[Math.min(index, list.length - 1)];

  const onError = useCallback(() => {
    setIndex((i) => (i + 1 < list.length ? i + 1 : i));
  }, [list.length]);

  if (!src) return null;

  const imageSrc = resolvePosterSrcForOptimizer(src);

  const q = quality ?? (priority ? 78 : 72);

  return (
    <Image
      key={`${src}::${index}`}
      src={imageSrc}
      alt={alt}
      fill
      sizes={sizes}
      quality={q}
      className={cn(className)}
      priority={priority}
      decoding={priority ? "sync" : "async"}
      unoptimized={srcNeedsUnoptimized(src)}
      onError={onError}
    />
  );
}
