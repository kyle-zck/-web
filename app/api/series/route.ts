import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { PUBLIC_LISTED_SERIES_TAG } from "@/lib/cache/cache-tags";
import { getAllSeries } from "@/lib/series-repo";
import type { Series } from "@/constants/mock-data";

/** 避免 `next build` 预渲染阶段连库（Vercel 上 DATABASE_URL 错误时构建会失败） */
export const dynamic = "force-dynamic";

function parseRevalidate(envVal: string | undefined, fallback: number) {
  if (envVal == null || envVal === "") return fallback;
  const n = Number(envVal);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** 默认略增大，减轻 DB；生产可在环境变量覆盖，见 docs/COVER-CDN-AND-API-CACHE.md */
const revalidateSeconds = parseRevalidate(process.env.PUBLIC_SERIES_API_REVALIDATE, 120);

/** 跨请求缓存列表查询，减轻 Explore 等高频读 */
const getListedSeriesCached = unstable_cache(
  async () => {
    const all = await getAllSeries();
    return all.filter((s) => s.listed !== false);
  },
  ["public-api-listed-series-v1"],
  { revalidate: Math.max(1, revalidateSeconds), tags: [PUBLIC_LISTED_SERIES_TAG] }
);

function toLiteSeriesList(full: Series[]): Series[] {
  return full.map((s) => ({
    ...s,
    /** 列表页不需要分集与长 videoUrl，显著减小 JSON 体积 */
    episodes: []
  }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lite =
    searchParams.get("lite") === "1" ||
    searchParams.get("lite") === "true" ||
    searchParams.get("summary") === "1";

  const listed = await getListedSeriesCached();
  const series = lite ? toLiteSeriesList(listed) : listed;

  return NextResponse.json(
    { ok: true, series },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${revalidateSeconds}, stale-while-revalidate=300`
      }
    }
  );
}
