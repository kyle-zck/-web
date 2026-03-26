import { NextRequest, NextResponse } from "next/server";
import { invalidateEngagementEverywhere } from "@/lib/cache/invalidate-data-cache";
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
  const isNewViewer = await recordSeriesView(clientId, seriesId);
  if (isNewViewer) {
    await invalidateEngagementEverywhere([seriesId]);
  }
  const viewsCount = await getViewsCount(seriesId);
  return NextResponse.json({ ok: true, viewsCount });
}
