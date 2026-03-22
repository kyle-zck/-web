import { NextRequest, NextResponse } from "next/server";
import { getCollectionCount, getLikesCount, getViewsCount } from "@/lib/user-repo";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const seriesId = params.id;
  if (!seriesId) {
    return NextResponse.json({ ok: false, error: "seriesId required" }, { status: 400 });
  }

  const [collectionCount, likesCount, viewsCount] = await Promise.all([
    getCollectionCount(seriesId),
    getLikesCount(seriesId),
    getViewsCount(seriesId)
  ]);

  return NextResponse.json({
    ok: true,
    collectionCount,
    likesCount,
    viewsCount
  });
}
