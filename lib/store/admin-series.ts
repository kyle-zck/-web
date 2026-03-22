"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Episode, Series } from "@/constants/mock-data";
import { SERIES_LIST } from "@/constants/mock-data";
import {
  coverPlaceholder,
  episodeThumbPlaceholder,
  posterPlaceholder,
  slugify
} from "@/lib/admin/placeholders";

type AdminSeriesState = {
  series: Series[];
  addSeries: (data: {
    title: string;
    description: string;
    tags: string[];
    coverDataUrl: string;
    episodeVideoUrls: string[];
  }) => void;
  removeSeries: (seriesId: string) => void;
};

export const useAdminSeriesStore = create<AdminSeriesState>()(
  persist(
    (set, get) => ({
      series: SERIES_LIST,

      addSeries: ({ title, description, tags, coverDataUrl, episodeVideoUrls }) => {
        const cleanTitle = title.trim();
        const baseId = slugify(cleanTitle) || `series-${Date.now()}`;
        const seriesId = `${baseId}-${Math.random().toString(16).slice(2, 6)}`;
        const category = tags[0] ?? "Romance";

        const cover = coverDataUrl || coverPlaceholder(cleanTitle, category);
        const poster =
          coverDataUrl ? coverDataUrl : posterPlaceholder(cleanTitle, description);

        const total = Math.max(1, episodeVideoUrls.length);

        const episodes: Episode[] = Array.from({ length: total }).map((_, i) => {
          const index = i + 1;
          const videoUrl = episodeVideoUrls[i] ?? "";
          return {
            id: `${seriesId}-ep-${index}`,
            index,
            title: `第 ${index} 集`,
            duration: `${6 + (index % 3)}:${String((index * 7) % 60).padStart(2, "0")}`,
            thumbnail: episodeThumbPlaceholder(`第 ${index} 集`, index <= 3 ? "FREE" : "LOCKED"),
            videoUrl,
            isFree: index <= 3
          };
        });

        const next: Series = {
          id: seriesId,
          title: cleanTitle,
          tagline: description.slice(0, 30) || "短剧简介",
          category,
          tags,
          cover,
          poster,
          isTrending: true,
          description,
          episodes
        };

        set({
          series: [next, ...get().series]
        });
      },

      removeSeries: (seriesId) => {
        set({
          series: get().series.filter((s) => s.id !== seriesId)
        });
      }
    }),
    {
      name: "reelshort-admin-series-v1",
      version: 1
    }
  )
);

