import { NextRequest, NextResponse } from "next/server";
import { getEngagementCountsBatch } from "@/lib/user-repo";

export const dynamic = "force-dynamic";

const MAX_IDS = 120;

/** 批量查询剧目收藏/点赞/观看数，供 Explore 等列表与详情页数据一致 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const raw = body.ids as unknown;
  if (!Array.isArray(raw)) {
    return NextResponse.json({ ok: false, error: "ids array required" }, { status: 400 });
  }

  const ids = raw
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .slice(0, MAX_IDS);

  if (ids.length === 0) {
    return NextResponse.json({ ok: true, byId: {} });
  }

  const batch = await getEngagementCountsBatch(ids);
  const byId: Record<
    string,
    { collectionCount: number; likesCount: number; viewsCount: number }
  > = {};
  for (const seriesId of ids) {
    byId[seriesId] =
      batch[seriesId] ?? { collectionCount: 0, likesCount: 0, viewsCount: 0 };
  }

  return NextResponse.json(
    { ok: true, byId },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300"
      }
    }
  );
}
