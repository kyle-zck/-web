import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import {
  getAllRechargeRecords,
  addRechargeRecord,
  getRechargeByUid
} from "@/lib/user-repo";

export async function GET(req: NextRequest) {
  const unauth = requireAdminSession();
  if (unauth) return unauth;

  const uid = req.nextUrl.searchParams.get("uid");
  if (uid) {
    const records = getRechargeByUid(uid);
    return NextResponse.json({ ok: true, records });
  }

  const records = getAllRechargeRecords();
  return NextResponse.json({ ok: true, records });
}

export async function POST(req: NextRequest) {
  const unauth = requireAdminSession();
  if (unauth) return unauth;

  const body = await req.json().catch(() => ({}));
  const { uid, date, price, tier } = body;
  if (!uid || !date || typeof price !== "number" || !tier) {
    return NextResponse.json(
      { ok: false, error: "uid, date, price, tier required" },
      { status: 400 }
    );
  }

  const record = addRechargeRecord({ uid, date, price, tier });
  return NextResponse.json({ ok: true, record });
}
