import { createServerClient } from "@supabase/ssr";
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
    secure
  };
}

/** 后台 /admin：ADMIN_KEY + JWT Cookie，与前台 Supabase 会话隔离 */
async function adminMiddleware(req: NextRequest) {
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

/** 前台：刷新 Supabase Auth Cookie（PKCE） */
async function supabaseMiddleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request
  });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        supabaseResponse = NextResponse.next({
          request
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      }
    }
  });

  await supabase.auth.getUser();
  return supabaseResponse;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    return adminMiddleware(request);
  }

  return supabaseMiddleware(request);
}

export const config = {
  matcher: [
    /*
     * 排除整个 /_next/*（含 dev 下 webpack.js、主 chunk 等，不仅限于 _next/static），
     * 否则中间件会拦截 Next 内部资源导致控制台 500。
     * /admin 走后台 JWT，其余走 Supabase 会话刷新。
     */
    "/((?!_next/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
