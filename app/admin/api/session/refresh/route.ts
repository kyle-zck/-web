import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";

/** 前端保活：无导航时仍刷新 JWT（middleware 已续期 Cookie，此处仅 200） */
export async function POST() {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  return NextResponse.json({ ok: true });
}
