import { NextRequest, NextResponse } from "next/server";
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

  getOrCreateUid(clientId);
  const seriesIds = getUserFavorites(clientId);
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

  getOrCreateUid(clientId);
  syncUserFavorites(clientId, seriesIds);
  return NextResponse.json({ ok: true });
}
