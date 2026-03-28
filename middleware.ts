import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * 公开只读 API 不依赖 Supabase 会话；跳过 getUser() 可省一次边缘往返（常见于首屏与列表轮询）。
 * 需刷新的路由仍走下方 supabaseMiddleware。
 */
function shouldSkipSupabaseSessionRefresh(req: NextRequest): boolean {
  if (req.method !== "GET") return false;
  const p = req.nextUrl.pathname;
  if (p === "/api/app-config" || p === "/api/tag-catalog") return true;
  if (p === "/api/series" || p.startsWith("/api/series/")) return true;
  return false;
}

/** 前台：刷新 Supabase Auth Cookie；失败时放行，避免整站 404/白屏 */
async function supabaseMiddleware(request: NextRequest): Promise<NextResponse> {
  try {
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
  } catch (e) {
    console.error("[middleware] Supabase 会话刷新失败，已跳过", e);
    return NextResponse.next();
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /**
   * 必须直接放行 Next 内部资源（含 dev 下 webpack、HMR、RSC chunk 等）。
   * 若误进中间件，会出现 layout.css / app/*.js 大量 404。
   */
  if (pathname.startsWith("/_next")) {
    return NextResponse.next();
  }
  if (pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    try {
      const { adminMiddleware } = await import("@/lib/middleware/admin-auth");
      return adminMiddleware(request);
    } catch (e) {
      console.error("[middleware] admin 鉴权模块加载失败", e);
      return NextResponse.next();
    }
  }

  if (shouldSkipSupabaseSessionRefresh(request)) {
    return NextResponse.next();
  }

  return await supabaseMiddleware(request);
}

/**
 * 必须与 Next 文档一致地排除静态与内部路径；自定义 `(?!_next/)` 在部分环境下可能对 `/_next/static/...` 匹配不一致，
 * 进而让中间件介入静态资源请求，出现 layout.css / main-app.js 整页 404、无样式白屏。
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|_next/webpack|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"
  ]
};
