import { NextRequest, NextResponse } from "next/server";
import { getCollectionCount, getLikesCount } from "@/lib/user-repo";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const seriesId = params.id;
  if (!seriesId) {
    return NextResponse.json({ ok: false, error: "seriesId required" }, { status: 400 });
  }

  const collectionCount = getCollectionCount(seriesId);
  const likesCount = getLikesCount(seriesId);

  return NextResponse.json({
    ok: true,
    collectionCount,
    likesCount
  });
}
