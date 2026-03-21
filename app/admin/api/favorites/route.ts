import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { getAllUserFavorites } from "@/lib/user-repo";

export async function GET() {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const byClient = await getAllUserFavorites();
  return NextResponse.json({ ok: true, byClient });
}
