"use client";

import type React from "react";
import type { Session } from "@supabase/supabase-js";
import { useEffect } from "react";
import { getSupabaseBrowserClientAsync } from "@/lib/supabase/browser";
import { useUserStore } from "@/lib/store/user";

/**
 * 监听 Supabase 会话并同步到 Zustand；未配置 NEXT_PUBLIC_SUPABASE_* 时跳过。
 * 通过异步 import 加载 Supabase，避免整包进入首屏同步解析（Lighthouse「未使用 JS」）。
 */
export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const applySupabaseUser = useUserStore((s) => s.applySupabaseUser);
  const setAuthReady = useUserStore((s) => s.setAuthReady);
  const fetchUid = useUserStore((s) => s.fetchUid);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void getSupabaseBrowserClientAsync().then((supabase) => {
      if (cancelled) return;
      if (!supabase) {
        setAuthReady(true);
        return;
      }

      void supabase.auth.getSession().then((res: { data: { session: Session | null } }) => {
        if (cancelled) return;
        const session = res.data.session;
        applySupabaseUser(session?.user ?? null);
        setAuthReady(true);
        if (session?.user) {
          void fetchUid();
        }
      });

      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
        if (cancelled) return;
        applySupabaseUser(session?.user ?? null);
        if (session?.user) {
          void fetchUid();
        }
      });
      unsubscribe = () => subscription.unsubscribe();
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [applySupabaseUser, setAuthReady, fetchUid]);

  return <>{children}</>;
}
