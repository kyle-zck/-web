import { NextRequest, NextResponse } from "next/server";
import { invalidateEngagementEverywhere } from "@/lib/cache/invalidate-data-cache";
import {
  getOrCreateUid,
  getUserFavorites,
  syncUserFavorites
} from "@/lib/user-repo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "clientId required" }, { status: 400 });
  }

  await getOrCreateUid(clientId);
  const seriesIds = await getUserFavorites(clientId);
  return NextResponse.json({ ok: true, seriesIds });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { clientId, seriesIds } = body;
  if (!clientId || !Array.isArray(seriesIds)) {
    return NextResponse.json(
      { ok: false, error: "clientId and seriesIds required" },
      { status: 400 }
    );
  }

  const nextIds = seriesIds.filter((x): x is string => typeof x === "string" && x.length > 0);

  await getOrCreateUid(clientId);
  const prev = await getUserFavorites(clientId);
  await syncUserFavorites(clientId, nextIds);
  await invalidateEngagementEverywhere([...new Set([...prev, ...nextIds])]);
  return NextResponse.json({ ok: true });
}
