import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSessionToken, SESSION_COOKIE, verifySessionToken } from "@/lib/admin/session";

function cookieOpts() {
  const secure =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
    secure
  };
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isLoginPage = pathname === "/admin/login";
  const isPublicApi =
    (pathname === "/admin/api/login" && req.method === "POST") ||
    (pathname === "/admin/api/logout" && req.method === "POST") ||
    (pathname === "/admin/api/auth/change-password" && req.method === "POST");

  if (isLoginPage || isPublicApi) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value ?? "";

  if (!token || !(await verifySessionToken(token))) {
    if (pathname.startsWith("/admin/api")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const newToken = await createSessionToken();
  const res = NextResponse.next();
  res.cookies.set(SESSION_COOKIE, newToken, cookieOpts());
  return res;
}

export const config = {
  matcher: ["/admin/:path*"]
};
