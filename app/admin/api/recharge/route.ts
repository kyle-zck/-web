import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import {
  getAllRechargeRecords,
  addRechargeRecord,
  getRechargeByUid,
  grantMembershipByUid,
  deleteRechargeRecordById
} from "@/lib/user-repo";
import { getAppConfigOrDefault } from "@/lib/app-config";
import { adminQueryUsers } from "@/lib/user-repo";

function toYmd(input: Date): string {
  const y = input.getFullYear();
  const m = String(input.getMonth() + 1).padStart(2, "0");
  const d = String(input.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function calcRemainingDaysFromRecharge(dateYmd: string, rechargeDays: number): number {
  const days = Number.isFinite(rechargeDays) ? Math.max(0, Math.floor(rechargeDays)) : 0;
  const start = new Date(`${dateYmd}T00:00:00`);
  if (!Number.isFinite(start.getTime())) return 0;
  const today = new Date();
  const todayYmd = toYmd(today);
  const now = new Date(`${todayYmd}T00:00:00`);
  const diff = Math.floor((now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, days - (diff + 1));
}

function normalizeTierByTemplates(rawTier: string, allowed: string[]): string {
  const t = rawTier.trim();
  if (!t) return "";
  if (t === "/") return "/";
  const matched = allowed.find((x) => x === t);
  return matched ?? t;
}

async function uidExistsInAdminUsers(uid: string): Promise<boolean> {
  const rows = await adminQueryUsers({ uid: uid.trim() });
  return rows.length > 0;
}

async function recomputeMembershipByUid(uid: string): Promise<void> {
  const records = await getRechargeByUid(uid);
  const best = records
    .map((r) => ({
      tier: r.tier,
      remaining: calcRemainingDaysFromRecharge(r.date, r.rechargeDays)
    }))
    .filter((x) => x.remaining > 0)
    .sort((a, b) => b.remaining - a.remaining)[0];
  if (!best) {
    await grantMembershipByUid({ uid, planLabel: "", remainingDays: 0 });
    return;
  }
  await grantMembershipByUid({
    uid,
    planLabel: best.tier === "/" ? "" : best.tier,
    remainingDays: best.remaining
  });
}

export async function GET(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const uid = req.nextUrl.searchParams.get("uid");
  const tier = (req.nextUrl.searchParams.get("tier") ?? "").trim();
  const recordsRaw = uid ? await getRechargeByUid(uid) : await getAllRechargeRecords();
  const records = recordsRaw
    .map((r) => ({
      ...r,
      remainingDays: calcRemainingDaysFromRecharge(r.date, r.rechargeDays)
    }))
    .filter((r) => (tier ? r.tier === tier : true));
  return NextResponse.json({ ok: true, records });
}

export async function POST(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const body = await req.json().catch(() => ({}));
  const { uid, date, price, tier, remainingDays } = body as {
    uid?: string;
    date?: string;
    price?: number;
    tier?: string;
    remainingDays?: number;
  };
  if (!uid || !date || typeof price !== "number" || !tier) {
    return NextResponse.json(
      { ok: false, error: "uid, date, price, tier required" },
      { status: 400 }
    );
  }
  if (!(await uidExistsInAdminUsers(uid))) {
    return NextResponse.json(
      { ok: false, error: "uid not found in users" },
      { status: 400 }
    );
  }

  const cfg = await getAppConfigOrDefault();
  const templateTiers = (cfg.subscriptionPlans ?? [])
    .map((x) => x.label)
    .filter((x) => x.trim().length > 0);
  const normalizedTier = normalizeTierByTemplates(tier, templateTiers);
  const rechargeDays = Number.isFinite(Number(remainingDays)) ? Math.max(0, Math.floor(Number(remainingDays))) : 0;

  const record = await addRechargeRecord({ uid, date, price, tier: normalizedTier, rechargeDays });
  await recomputeMembershipByUid(uid);
  return NextResponse.json({ ok: true, record });
}

export async function PUT(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  const body = await req.json().catch(() => ({}));
  const { uid, tier, remainingDays } = body as {
    uid?: string;
    tier?: string;
    remainingDays?: number;
  };
  if (!uid || !tier || typeof remainingDays !== "number") {
    return NextResponse.json(
      { ok: false, error: "uid, tier, remainingDays required" },
      { status: 400 }
    );
  }
  const cfg = await getAppConfigOrDefault();
  const templateTiers = (cfg.subscriptionPlans ?? [])
    .map((x) => x.label)
    .filter((x) => x.trim().length > 0);
  const normalizedTier = normalizeTierByTemplates(tier, templateTiers);
  await grantMembershipByUid({
    uid,
    planLabel: normalizedTier === "/" ? "" : normalizedTier,
    remainingDays: Math.max(0, Math.floor(remainingDays))
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  const body = await req.json().catch(() => ({}));
  const { id, uid } = body as { id?: string; uid?: string };
  if (!id || !uid) {
    return NextResponse.json({ ok: false, error: "id, uid required" }, { status: 400 });
  }
  const removed = await deleteRechargeRecordById(id);
  if (!removed) {
    return NextResponse.json({ ok: false, error: "record not found" }, { status: 404 });
  }
  await recomputeMembershipByUid(uid);
  return NextResponse.json({ ok: true });
}
