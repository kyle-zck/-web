import { NextRequest, NextResponse } from "next/server";
import { invalidateEngagementEverywhere } from "@/lib/cache/invalidate-data-cache";
import {
  getOrCreateUid,
  getUserLikes,
  toggleUserLike
} from "@/lib/user-repo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "clientId required" }, { status: 400 });
  }

  await getOrCreateUid(clientId);
  const seriesIds = await getUserLikes(clientId);
  return NextResponse.json({ ok: true, seriesIds });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { clientId, seriesId, liked } = body;
  if (!clientId || !seriesId) {
    return NextResponse.json(
      { ok: false, error: "clientId and seriesId required" },
      { status: 400 }
    );
  }

  await getOrCreateUid(clientId);
  const current = await getUserLikes(clientId);
  const has = current.includes(seriesId);
  const shouldBeLiked = liked === true;
  if (has !== shouldBeLiked) {
    await toggleUserLike(clientId, seriesId);
    await invalidateEngagementEverywhere([seriesId]);
  }
  return NextResponse.json({ ok: true, liked: shouldBeLiked });
}
