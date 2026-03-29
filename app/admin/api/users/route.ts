import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { adminQueryUsers, deleteUsersByUids, getAllRechargeRecords } from "@/lib/user-repo";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const { searchParams } = new URL(req.url);
  const uid = searchParams.get("uid") ?? "";
  const name = searchParams.get("name") ?? "";
  const email = searchParams.get("email") ?? "";
  const provider = (searchParams.get("provider") ?? "") as
    | "google"
    | "facebook"
    | "apple"
    | "";
  const membershipPlan = searchParams.get("membershipPlan") ?? "";
  const remainingSort = (searchParams.get("remainingSort") ?? "") as
    | "remainingAsc"
    | "remainingDesc"
    | "";

  const users = await adminQueryUsers({
    uid,
    name,
    email,
    provider,
    membershipPlan,
    remainingSort: remainingSort || undefined
  });
  const records = await getAllRechargeRecords();
  const statByUid = new Map<
    string,
    { rechargeCount: number; rechargeTotalUsd: number; lastRechargeAt: string; recent: string[] }
  >();
  for (const r of records) {
    const prev = statByUid.get(r.uid) ?? {
      rechargeCount: 0,
      rechargeTotalUsd: 0,
      lastRechargeAt: "",
      recent: []
    };
    prev.rechargeCount += 1;
    prev.rechargeTotalUsd += Number(r.price) || 0;
    const ts = r.createdAt || r.date;
    if (!prev.lastRechargeAt || ts > prev.lastRechargeAt) prev.lastRechargeAt = ts;
    if (prev.recent.length < 3) {
      prev.recent.push(`${r.date} ${r.tier} $${Number(r.price).toFixed(2)}`);
    }
    statByUid.set(r.uid, prev);
  }
  const usersWithRecharge = users.map((u) => {
    const stat = statByUid.get(u.uid);
    return {
      ...u,
      rechargeCount: stat?.rechargeCount ?? 0,
      rechargeTotalUsd: Number((stat?.rechargeTotalUsd ?? 0).toFixed(2)),
      lastRechargeAt: stat?.lastRechargeAt ?? "",
      rechargeRecent: stat?.recent ?? []
    };
  });
  return NextResponse.json({ ok: true, users: usersWithRecharge });
}

export async function DELETE(req: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  const body = await req.json().catch(() => ({}));
  const uids = Array.isArray(body?.uids) ? (body.uids as string[]) : [];
  if (uids.length === 0) {
    return NextResponse.json({ ok: false, error: "uids required" }, { status: 400 });
  }
  const removed = await deleteUsersByUids(uids);
  return NextResponse.json({ ok: true, removed });
}
