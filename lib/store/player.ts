import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Episode, Series } from "@/constants/mock-data";

type SeriesId = Series["id"];

type ProgressKey = `${SeriesId}::${number}`;

/** 是否锁定：episode.index >= lockStartIndex 且未订阅 */
export function isEpisodeLocked(series: Series, episode: Episode): boolean {
  const lockStart = series.lockStartIndex ?? 4;
  return episode.index >= lockStart;
}

interface PlayerState {
  seriesId?: SeriesId;
  episodeIndex: number;
  isSubscribed: boolean;
  /** 订阅到期时间戳（毫秒），用于计算倒数天数 */
  subscriptionExpiryDate?: number;
  /** 会员类型：Monthly VIP / Weekly VIP / Yearly VIP */
  subscriptionTier?: string;
  progressSeconds: Record<ProgressKey, number>;

  setSeries: (seriesId: SeriesId) => void;
  setEpisodeIndex: (episodeIndex: number) => void;
  isEpisodeUnlocked: (series: Series, episode: Episode) => boolean;
  setSubscribed: (v: boolean, durationDays?: number, tier?: string) => void;
  getDaysRemaining: () => number;
  saveProgress: (seriesId: SeriesId, episodeIndex: number, seconds: number) => void;
  getProgress: (seriesId: SeriesId, episodeIndex: number) => number;
  resetProgress: (seriesId: SeriesId, episodeIndex: number) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      seriesId: undefined,
      episodeIndex: 1,
      isSubscribed: false,
      progressSeconds: {},

      setSeries: (seriesId) =>
        set((s) => ({
          seriesId,
          episodeIndex: s.seriesId === seriesId ? s.episodeIndex : 1
        })),

      setEpisodeIndex: (episodeIndex) => set({ episodeIndex }),

      isEpisodeUnlocked: (series, episode) => {
        if (get().isSubscribed) return true;
        return !isEpisodeLocked(series, episode);
      },

      setSubscribed: (v, durationDays = 30, tier) => {
        if (v) {
          const expiry = Date.now() + durationDays * 24 * 60 * 60 * 1000;
          set({
            isSubscribed: true,
            subscriptionExpiryDate: expiry,
            subscriptionTier: tier ?? "VIP"
          });
        } else {
          set({
            isSubscribed: false,
            subscriptionExpiryDate: undefined,
            subscriptionTier: undefined
          });
        }
      },
      getDaysRemaining: () => {
        const expiry = get().subscriptionExpiryDate;
        if (!expiry) return 0;
        const days = Math.ceil((expiry - Date.now()) / (24 * 60 * 60 * 1000));
        return Math.max(0, days);
      },

      saveProgress: (seriesId, episodeIndex, seconds) => {
        const key: ProgressKey = `${seriesId}::${episodeIndex}`;
        const next = Math.max(0, Math.floor(seconds));
        const current = get().progressSeconds[key] ?? 0;
        // Reduce frequent persist writes to avoid playback jank in local runtime.
        if (next <= current || next - current < 2) return;
        set((s) => ({
          progressSeconds: {
            ...s.progressSeconds,
            [key]: next
          }
        }));
      },

      getProgress: (seriesId, episodeIndex) => {
        const key: ProgressKey = `${seriesId}::${episodeIndex}`;
        return get().progressSeconds[key] ?? 0;
      },

      resetProgress: (seriesId, episodeIndex) => {
        const key: ProgressKey = `${seriesId}::${episodeIndex}`;
        set((s) => ({
          progressSeconds: {
            ...s.progressSeconds,
            [key]: 0
          }
        }));
      }
    }),
    {
      name: "reelshort-player-store",
      version: 2
    }
  )
);
