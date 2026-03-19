import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export function requireAdminSession() {
  const session = cookies().get("admin_session")?.value;
  if (session !== "1") {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return null;
}

