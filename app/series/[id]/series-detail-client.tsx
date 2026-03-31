"use client";

import dynamic from "next/dynamic";
import type { Series } from "@/constants/mock-data";
import type { EngagementCounts } from "@/lib/user-repo";
import { SeriesDetailSkeleton } from "@/components/player/series-detail-skeleton";

/**
 * SSR=true：RSC 层渲染骨架的 HTML，刷新页首屏有内容可见。
 * 仅播放器等重型 client-only 逻辑放在 ImmersiveSeriesDetail 内部。
 * dynamic chunk 仍然生效（播放页相关代码独立拆包）。
 */
const ImmersiveSeriesDetail = dynamic(
  () =>
    import("@/components/player/immersive-series-detail").then(
      (m) => m.ImmersiveSeriesDetail
    ),
  {
    loading: () => <SeriesDetailSkeleton />,
    ssr: true
  }
);

export function SeriesDetailClient({
  series,
  initialEngagement
}: {
  series: Series;
  initialEngagement?: EngagementCounts;
}) {
  return (
    <ImmersiveSeriesDetail
      key={series.id}
      series={series}
      initialEngagement={initialEngagement}
    />
  );
}
