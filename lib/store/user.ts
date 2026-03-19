import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserState {
  userId?: string;
  isLoggedIn: boolean;

  loginWithSocial: (provider: "google" | "facebook" | "apple") => void;
  logout: () => void;
}

function generateUserId(provider: string) {
  const base = Math.random().toString(16).slice(2, 10).toUpperCase();
  return `USER-${provider}-${base}`;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      userId: undefined,
      isLoggedIn: false,

      loginWithSocial: (provider) => {
        set({
          isLoggedIn: true,
          userId: generateUserId(provider)
        });
      },

      logout: () => set({ isLoggedIn: false, userId: undefined })
    }),
    {
      name: "reelshort-user-store",
      version: 1
    }
  )
);

