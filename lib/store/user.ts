import type { User } from "@supabase/supabase-js";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

interface UserState {
  /** 展示用：优先邮箱，否则 Supabase user id */
  userId?: string;
  email?: string;
  supabaseUserId?: string;
  /** 管理后台分配的 UID（/api/user/uid） */
  uid?: string;
  isLoggedIn: boolean;
  /** 浏览器端是否已尝试拉取过 Supabase 会话 */
  authReady: boolean;

  applySupabaseUser: (user: User | null) => void;
  setAuthReady: (ready: boolean) => void;

  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (
    email: string,
    password: string
  ) => Promise<{ error?: string; needsEmailConfirmation?: boolean }>;
  signInWithOAuth: (provider: "google" | "facebook" | "apple") => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  setUid: (uid: string) => void;
  fetchUid: () => Promise<string | null>;
}

function mapUser(user: User | null) {
  if (!user) {
    return {
      isLoggedIn: false,
      userId: undefined,
      email: undefined,
      supabaseUserId: undefined
    };
  }
  return {
    isLoggedIn: true,
    supabaseUserId: user.id,
    email: user.email ?? undefined,
    userId: user.email ?? user.id
  };
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      userId: undefined,
      email: undefined,
      supabaseUserId: undefined,
      uid: undefined,
      isLoggedIn: false,
      authReady: false,

      setAuthReady: (ready) => set({ authReady: ready }),

      applySupabaseUser: (user) => {
        if (!user) {
          set({ ...mapUser(null), uid: undefined });
        } else {
          set(mapUser(user));
        }
      },

      signInWithEmail: async (email, password) => {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) return { error: "not_configured" };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };
        return {};
      },

      signUpWithEmail: async (email, password) => {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) return { error: "not_configured" };
        const redirect =
          typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirect }
        });
        if (error) return { error: error.message };
        if (data.user && !data.session) return { needsEmailConfirmation: true };
        return {};
      },

      signInWithOAuth: async (provider) => {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) return { error: "not_configured" };
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo:
              typeof window !== "undefined"
                ? `${window.location.origin}/auth/callback`
                : undefined
          }
        });
        if (error) return { error: error.message };
        return {};
      },

      logout: async () => {
        const supabase = getSupabaseBrowserClient();
        if (supabase) await supabase.auth.signOut();
        set({
          isLoggedIn: false,
          userId: undefined,
          email: undefined,
          supabaseUserId: undefined,
          uid: undefined
        });
      },

      setUid: (uid) => set({ uid }),

      fetchUid: async () => {
        const { supabaseUserId } = get();
        if (!supabaseUserId) return null;
        const res = await fetch(`/api/user/uid?clientId=${encodeURIComponent(supabaseUserId)}`);
        const json = await res.json();
        if (json?.ok && json.uid) {
          set({ uid: json.uid });
          return json.uid;
        }
        return null;
      }
    }),
    {
      name: "reelshort-user-store",
      version: 3,
      partialize: (state) => ({ uid: state.uid })
    }
  )
);
