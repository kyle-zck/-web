import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateUid,
  getRechargeByUid,
  addRechargeRecord
} from "@/lib/user-repo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "clientId required" }, { status: 400 });
  }

  const user = await getOrCreateUid(clientId);
  const records = await getRechargeByUid(user.uid);
  return NextResponse.json({ ok: true, uid: user.uid, records });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { clientId, price, tier } = body;
  if (!clientId || typeof price !== "number" || !tier) {
    return NextResponse.json(
      { ok: false, error: "clientId, price, tier required" },
      { status: 400 }
    );
  }

  const user = await getOrCreateUid(clientId);
  const date = new Date().toISOString().slice(0, 10);
  const record = await addRechargeRecord({
    uid: user.uid,
    date,
    price,
    tier
  });
  return NextResponse.json({ ok: true, record });
}
