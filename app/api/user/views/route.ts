import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUid, getViewsCount, recordSeriesView } from "@/lib/user-repo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { clientId, seriesId } = body as { clientId?: string; seriesId?: string };
  if (!clientId || !seriesId) {
    return NextResponse.json(
      { ok: false, error: "clientId and seriesId required" },
      { status: 400 }
    );
  }

  await getOrCreateUid(clientId);
  await recordSeriesView(clientId, seriesId);
  const viewsCount = await getViewsCount(seriesId);
  return NextResponse.json({ ok: true, viewsCount });
}
