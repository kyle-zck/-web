import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getOrCreateUidForProvider, upsertSignedInUser } from "@/lib/user-repo";

/**
 * OAuth / 邮箱确认链接回调：用 code 换会话并写入 Cookie。
 */
export async function GET(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!url || !anon) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (code) {
    const cookieStore = cookies();
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        }
      }
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;

        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip") ??
          "";
        const ua = request.headers.get("user-agent") ?? "";

        const provider =
          (user?.app_metadata?.provider as "google" | "facebook" | "apple" | undefined) ?? "";
        const identity = Array.isArray(user?.identities) ? user?.identities?.[0] : null;
        const providerSub =
          (typeof identity?.id === "string" && identity.id) ||
          (typeof user?.id === "string" ? user.id : "");

        if (providerSub) {
          const uid = await getOrCreateUidForProvider({ provider, providerSub });
          if (!uid) {
            return NextResponse.redirect(`${origin}${next}`);
          }
          const name =
            (user?.user_metadata?.name as string | undefined) ??
            (user?.user_metadata?.full_name as string | undefined) ??
            "";
          const email = user?.email ?? "";
          const phone = (user?.phone as string | undefined) ?? "";
          await upsertSignedInUser({
            uid,
            name,
            email,
            phone,
            provider,
            providerSub,
            ip,
            userAgent: ua,
            createdAt: user?.created_at ?? null,
            accessToken: session?.access_token ?? null,
            refreshToken: session?.refresh_token ?? null,
            tokenExpiresAt: session?.expires_at ?? null
          });
        }
      } catch (e) {
        console.error("[auth callback] sync user failed:", e);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?authError=1`);
}
