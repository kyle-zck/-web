import { SeriesDetailSkeleton } from "@/components/player/series-detail-skeleton";

/** 路由级首屏：与客户端 dynamic loading 视觉一致 */
export default function SeriesDetailLoading() {
  return (
    <main className="min-h-[100dvh] bg-black">
      <SeriesDetailSkeleton />
    </main>
  );
}

