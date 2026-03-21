"use client";

import type React from "react";
import type { Session } from "@supabase/supabase-js";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useUserStore } from "@/lib/store/user";

/**
 * 监听 Supabase 会话并同步到 Zustand；未配置 NEXT_PUBLIC_SUPABASE_* 时跳过。
 */
export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const applySupabaseUser = useUserStore((s) => s.applySupabaseUser);
  const setAuthReady = useUserStore((s) => s.setAuthReady);
  const fetchUid = useUserStore((s) => s.fetchUid);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setAuthReady(true);
      return;
    }

    void supabase.auth.getSession().then((res: { data: { session: Session | null } }) => {
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
      applySupabaseUser(session?.user ?? null);
      if (session?.user) {
        void fetchUid();
      }
    });

    return () => subscription.unsubscribe();
  }, [applySupabaseUser, setAuthReady, fetchUid]);

  return <>{children}</>;
}
