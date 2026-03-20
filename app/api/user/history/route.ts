import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateUid,
  getWatchHistory,
  syncWatchHistory
} from "@/lib/user-repo";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "clientId required" }, { status: 400 });
  }

  getOrCreateUid(clientId);
  const entries = getWatchHistory(clientId);
  return NextResponse.json({ ok: true, entries });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { clientId, entries } = body;
  if (!clientId || !Array.isArray(entries)) {
    return NextResponse.json(
      { ok: false, error: "clientId and entries required" },
      { status: 400 }
    );
  }

  getOrCreateUid(clientId);
  syncWatchHistory(
    clientId,
    entries.map((e: { seriesId: string; episodeIndex: number; seconds: number }) => ({
      seriesId: e.seriesId,
      episodeIndex: e.episodeIndex,
      seconds: e.seconds,
      lastWatchedAt: new Date().toISOString()
    }))
  );
  return NextResponse.json({ ok: true });
}
