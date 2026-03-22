"use client";

import { Suspense } from "react";
import { ImmersiveSeriesDetail } from "@/components/player/immersive-series-detail";
import type { Series } from "@/constants/mock-data";

export function SeriesDetailClient({ series }: { series: Series }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4 text-sm text-zinc-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-red-500" />
          <span>加载中…</span>
        </div>
      }
    >
      <ImmersiveSeriesDetail series={series} />
    </Suspense>
  );
}
