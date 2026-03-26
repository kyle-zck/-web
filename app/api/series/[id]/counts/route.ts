import { NextRequest, NextResponse } from "next/server";
import { getEngagementCountsBatch } from "@/lib/user-repo";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const seriesId = params.id;
  if (!seriesId) {
    return NextResponse.json({ ok: false, error: "seriesId required" }, { status: 400 });
  }

  const row =
    (await getEngagementCountsBatch([seriesId]))[seriesId] ?? {
      collectionCount: 0,
      likesCount: 0,
      viewsCount: 0
    };

  return NextResponse.json({
    ok: true,
    collectionCount: row.collectionCount,
    likesCount: row.likesCount,
    viewsCount: row.viewsCount
  });
}
