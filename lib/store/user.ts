import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserState {
  userId?: string;
  uid?: string; // 管理后台分配的 UID
  isLoggedIn: boolean;

  loginWithSocial: (provider: "google" | "facebook" | "apple") => void;
  logout: () => void;
  setUid: (uid: string) => void;
  fetchUid: () => Promise<string | null>;
}

function generateUserId(provider: string) {
  const base = Math.random().toString(16).slice(2, 10).toUpperCase();
  return `USER-${provider}-${base}`;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      userId: undefined,
      uid: undefined,
      isLoggedIn: false,

      loginWithSocial: (provider) => {
        set({
          isLoggedIn: true,
          userId: generateUserId(provider)
        });
      },

      logout: () => set({ isLoggedIn: false, userId: undefined, uid: undefined }),

      setUid: (uid) => set({ uid }),

      fetchUid: async () => {
        const { userId } = get();
        if (!userId) return null;
        const res = await fetch(`/api/user/uid?clientId=${encodeURIComponent(userId)}`);
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
      version: 2
    }
  )
);

