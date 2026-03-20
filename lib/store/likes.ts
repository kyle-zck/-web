import { create } from "zustand";
import { persist } from "zustand/middleware";

interface LikesState {
  seriesIds: string[];
  toggle: (seriesId: string) => void;
  has: (seriesId: string) => boolean;
}

export const useLikesStore = create<LikesState>()(
  persist(
    (set, get) => ({
      seriesIds: [],

      toggle: (seriesId) =>
        set((s) => {
          const has = s.seriesIds.includes(seriesId);
          return {
            seriesIds: has
              ? s.seriesIds.filter((id) => id !== seriesId)
              : [...s.seriesIds, seriesId]
          };
        }),

      has: (seriesId) => get().seriesIds.includes(seriesId)
    }),
    { name: "reelshort-likes-store", version: 1 }
  )
);
