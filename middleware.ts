import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = req.cookies.get("admin_session")?.value;

  // 仅保护后台页面：跳过登录页与所有后台 API（API 自身已做鉴权）
  const isLoginPage = pathname === "/admin/login";
  const isAdminApi = pathname.startsWith("/admin/api");

  if (!session || session !== "1") {
    if (isLoginPage || isAdminApi) return NextResponse.next();
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"]
};

