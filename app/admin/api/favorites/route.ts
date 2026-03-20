import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { getAllUserFavorites } from "@/lib/user-repo";

export async function GET() {
  const unauth = requireAdminSession();
  if (unauth) return unauth;

  const byClient = getAllUserFavorites();
  return NextResponse.json({ ok: true, byClient });
}
