"use client";

import { formatEngagementCount } from "@/lib/format-count";
import { cn } from "@/lib/utils";

export type EngagementCounts = {
  viewsCount: number;
  collectionCount: number;
  likesCount: number;
};

function PlayIcon({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center leading-none ${className ?? ""}`} aria-hidden>
      ▶
    </span>
  );
}

/** 与播放页一致：观看 → 收藏 → 点赞；左图标右数字 */
export function SeriesEngagementInline({
  counts,
  className,
  dense
}: {
  counts: EngagementCounts;
  className?: string;
  /** Explore 卡片略紧凑 */
  dense?: boolean;
}) {
  const icon = dense ? "h-3.5 w-3.5 shrink-0" : "h-4 w-4 shrink-0";
  const text = dense
    ? "text-[11px] font-medium tabular-nums text-zinc-400 lg:text-xs"
    : "text-sm font-medium tabular-nums text-zinc-400";

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-4",
        className
      )}
    >
      <span className="inline-flex items-center gap-1 text-zinc-400" title="Views">
        <PlayIcon className={icon} />
        <span className={text}>{formatEngagementCount(counts.viewsCount)}</span>
      </span>
      <span className="inline-flex items-center gap-1 text-zinc-400" title="Favorites">
        <span className={cn("leading-none", dense ? "text-xs" : "text-sm")} aria-hidden>
          ★
        </span>
        <span className={text}>{formatEngagementCount(counts.collectionCount)}</span>
      </span>
      <span className="inline-flex items-center gap-1 text-zinc-400" title="Likes">
        <span className={cn("leading-none", dense ? "text-xs" : "text-sm")} aria-hidden>
          ♥
        </span>
        <span className={text}>{formatEngagementCount(counts.likesCount)}</span>
      </span>
    </div>
  );
}
