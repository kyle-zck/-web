import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { getAllUserViews } from "@/lib/user-repo";

export async function GET() {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const byClient = await getAllUserViews();
  return NextResponse.json({ ok: true, byClient });
}
