import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { getAllUsers } from "@/lib/user-repo";

export async function GET() {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const users = await getAllUsers();
  return NextResponse.json({ ok: true, users });
}
