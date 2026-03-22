import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export async function requireAdminSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySessionToken(token))) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized", errorKey: "sessionExpired" },
      { status: 401 }
    );
  }
  return null;
}
