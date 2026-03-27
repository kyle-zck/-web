import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateUid,
  getRechargeByUid,
  addRechargeRecord,
  grantMembershipByUid
} from "@/lib/user-repo";
import { getAppConfigOrDefault } from "@/lib/app-config";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "clientId required" }, { status: 400 });
  }

  const user = await getOrCreateUid(clientId);
  const records = await getRechargeByUid(user.uid);
  const withRemaining = records.map((r) => {
    const start = new Date(`${r.date}T00:00:00`);
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    const now = new Date(`${y}-${m}-${d}T00:00:00`);
    const diff = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    const remainingDays = Math.max(0, r.rechargeDays - (diff + 1));
    return { ...r, remainingDays };
  });
  return NextResponse.json({ ok: true, uid: user.uid, records: withRemaining });
}

export async function POST(req: NextRequest) {
  if (process.env.ENABLE_FAKE_PAYMENT === "1") {
    // allow in test mode
  } else {
    return NextResponse.json(
      { ok: false, error: "direct_recharge_disabled" },
      { status: 403 }
    );
  }
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
  const cfg = await getAppConfigOrDefault();
  const days =
    cfg.subscriptionPlans.find((p) => p.label === String(tier))?.durationDays ??
    cfg.subscriptionPlans.find((p) => p.id === String(tier))?.durationDays ??
    0;
  const record = await addRechargeRecord({
    uid: user.uid,
    date,
    price,
    tier,
    rechargeDays: Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 0
  });
  await grantMembershipByUid({
    uid: user.uid,
    planLabel: String(tier),
    remainingDays: Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 0
  });
  return NextResponse.json({ ok: true, record });
}
