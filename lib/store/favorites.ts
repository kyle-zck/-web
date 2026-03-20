import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FavoritesState {
  seriesIds: string[];
  toggle: (seriesId: string) => void;
  has: (seriesId: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>()(
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
    { name: "reelshort-favorites-store", version: 1 }
  )
);
