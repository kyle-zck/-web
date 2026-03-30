import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { seriesDetailTag } from "@/lib/cache/cache-tags";
import { getSeriesById } from "@/lib/series-repo";
import { getEngagementCountsBatch } from "@/lib/user-repo";
import { SeriesDetailClient } from "./series-detail-client";

export const dynamic = "force-dynamic";

function parseRevalidate(envVal: string | undefined, fallback: number) {
  if (envVal == null || envVal === "") return fallback;
  const n = Number(envVal);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const detailRevalidate = parseRevalidate(process.env.PUBLIC_SERIES_DETAIL_REVALIDATE, 45);

/**
 * 跨请求缓存剧目详情，减轻 PG/磁盘压力，加快重复进入同一剧播放页
 * 后台改剧后最多延迟 PUBLIC_SERIES_DETAIL_REVALIDATE 秒（见 .env.example）
 */
function getCachedSeriesForDetailPage(id: string) {
  return unstable_cache(
    async () => getSeriesById(id),
    ["series-detail-page", id],
    {
      revalidate: Math.max(5, detailRevalidate),
      tags: [seriesDetailTag(id)]
    }
  )();
}

export default async function SeriesDetailPage({
  params
}: {
  params: { id: string };
}) {
  // Fetch series data and engagement counts in parallel for faster TTFB
  const [series, engagementResult] = await Promise.all([
    getCachedSeriesForDetailPage(params.id),
    getEngagementCountsBatch([params.id]).catch(() => null)
  ]);

  if (!series) return notFound();

  const initialEngagement = engagementResult?.[params.id] ?? {
    collectionCount: 0,
    likesCount: 0,
    viewsCount: 0
  };

  return (
    <main className="h-full min-h-0 overflow-hidden lg:flex lg:flex-col">
      <SeriesDetailClient series={series} initialEngagement={initialEngagement} />
    </main>
  );
}
