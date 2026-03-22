"use client";

import dynamic from "next/dynamic";
import type { Series } from "@/constants/mock-data";
import { SeriesDetailSkeleton } from "@/components/player/series-detail-skeleton";

/** 拆 chunk：首包更小，点击 Play 后并行拉取播放页组件 */
const ImmersiveSeriesDetail = dynamic(
  () =>
    import("@/components/player/immersive-series-detail").then((m) => m.ImmersiveSeriesDetail),
  {
    loading: () => <SeriesDetailSkeleton />,
    ssr: false
  }
);

export function SeriesDetailClient({ series }: { series: Series }) {
  return <ImmersiveSeriesDetail series={series} />;
}
