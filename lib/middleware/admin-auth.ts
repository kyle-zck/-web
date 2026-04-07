import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_MS, verifySessionToken } from "@/lib/admin/session";

function cookieOpts() {
  const secure =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure,
    maxAge: SESSION_TTL_MS / 1000
  };
}

/** 仅 /admin 使用；由根 middleware 动态 import，避免前台请求在 Edge 里加载 jose */
export async function adminMiddleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isLoginPage = pathname === "/admin/login";
  const isPublicApi =
    (pathname === "/admin/api/login" && req.method === "POST") ||
    (pathname === "/admin/api/logout" && req.method === "POST");

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
