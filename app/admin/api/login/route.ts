import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSessionToken,
  SESSION_COOKIE,
  sessionCookieOptions
} from "@/lib/admin/session";
import {
  getStoredPasswordHash,
  verifyAdminPassword
} from "@/lib/admin/password-store";

export async function POST(req: Request) {
  const body = (await req.json()) as { key?: string };
  const key = (body.key ?? "").trim();

  const ok = Boolean(key) && (await verifyAdminPassword(key));
  if (!ok) {
    if (process.env.NODE_ENV === "development") {
      const hasStored = Boolean(await getStoredPasswordHash());
      console.warn(
        "[admin/login] rejected:",
        hasStored
          ? "a password is already saved (DB or data/admin-password.json); ADMIN_KEY is ignored until that hash is cleared."
          : "no saved hash; password must match ADMIN_KEY or default `admin`."
      );
    }
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const token = await createSessionToken();
  cookies().set(SESSION_COOKIE, token, sessionCookieOptions());

  return NextResponse.json({ ok: true });
}
