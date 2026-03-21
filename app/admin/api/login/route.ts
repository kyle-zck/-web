import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions
} from "@/lib/admin/session";
import { verifyAdminPassword } from "@/lib/admin/password-store";

export async function POST(req: Request) {
  const body = (await req.json()) as { key?: string };
  const key = body.key ?? "";

  if (!key || !(await verifyAdminPassword(key))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const token = await createSessionToken();
  cookies().set(SESSION_COOKIE, token, sessionCookieOptions());

  return NextResponse.json({ ok: true });
}
