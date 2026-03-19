import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Episode, Series } from "@/constants/mock-data";

type SeriesId = Series["id"];

type ProgressKey = `${SeriesId}::${number}`;

interface PlayerState {
  seriesId?: SeriesId;
  episodeIndex: number;
  coinBalance: number;
  unlocked: Record<SeriesId, number[]>;
  progressSeconds: Record<ProgressKey, number>;

  setSeries: (seriesId: SeriesId) => void;
  setEpisodeIndex: (episodeIndex: number) => void;
  isEpisodeUnlocked: (series: Series, episode: Episode) => boolean;
  unlockEpisode: (series: Series, episode: Episode, cost: number) => boolean;
  saveProgress: (seriesId: SeriesId, episodeIndex: number, seconds: number) => void;
  getProgress: (seriesId: SeriesId, episodeIndex: number) => number;
  addCoins: (amount: number) => void;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      seriesId: undefined,
      episodeIndex: 1,
      coinBalance: 30,
      unlocked: {},
      progressSeconds: {},

      setSeries: (seriesId) =>
        set((s) => ({
          seriesId,
          episodeIndex: s.seriesId === seriesId ? s.episodeIndex : 1
        })),

      setEpisodeIndex: (episodeIndex) => set({ episodeIndex }),

      isEpisodeUnlocked: (series, episode) => {
        if (episode.isFree) return true;
        const list = get().unlocked[series.id] ?? [];
        return list.includes(episode.index);
      },

      unlockEpisode: (series, episode, cost) => {
        if (episode.isFree) return true;
        const state = get();
        if (state.coinBalance < cost) return false;
        const current = state.unlocked[series.id] ?? [];
        if (current.includes(episode.index)) return true;
        set({
          coinBalance: state.coinBalance - cost,
          unlocked: {
            ...state.unlocked,
            [series.id]: [...current, episode.index]
          }
        });
        return true;
      },

      saveProgress: (seriesId, episodeIndex, seconds) => {
        const key: ProgressKey = `${seriesId}::${episodeIndex}`;
        set((s) => ({
          progressSeconds: {
            ...s.progressSeconds,
            [key]: Math.max(0, Math.floor(seconds))
          }
        }));
      },

      getProgress: (seriesId, episodeIndex) => {
        const key: ProgressKey = `${seriesId}::${episodeIndex}`;
        return get().progressSeconds[key] ?? 0;
      },

      addCoins: (amount) =>
        set((s) => ({ coinBalance: Math.max(0, s.coinBalance + amount) }))
    }),
    {
      name: "reelshort-player-store",
      version: 1
    }
  )
);

