import fs from "fs";
import path from "path";
import type { Series, Episode } from "@/constants/mock-data";
import { SERIES_LIST } from "@/constants/mock-data";
import { assignDramaIdForTitle } from "@/lib/drama-id-registry";
import {
  coverPlaceholder,
  episodeThumbPlaceholder,
  posterPlaceholder,
  slugify
} from "@/lib/admin/placeholders";

type Stored = {
  version: 1;
  series: Series[];
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "series-store.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function seed(): Stored {
  return {
    version: 1,
    series: SERIES_LIST
  };
}

function readStore(): Stored {
  ensureDir();
  if (!fs.existsSync(STORE_PATH)) {
    const initial = seed();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  const raw = fs.readFileSync(STORE_PATH, "utf-8");
  return JSON.parse(raw) as Stored;
}

function writeStore(store: Stored) {
  ensureDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export async function getAllSeries(): Promise<Series[]> {
  return readStore().series;
}

export async function getSeriesById(id: string): Promise<Series | null> {
  return readStore().series.find((s) => s.id === id) ?? null;
}

export type EpisodeVideoMetaItem = {
  fileName: string;
  /** 可选：显式本地资源 URL；未传时由文件名生成 file:// 形式占位 */
  localVideoUrl?: string;
};

export async function createSeries(data: {
  title: string;
  description: string;
  tags: Series["tags"];
  coverDataUrl: string;
  episodeVideoUrls: string[];
  /** 与 episodeVideoUrls 下标一一对应（通常为按集数排序后的上传文件） */
  episodeVideoMeta?: EpisodeVideoMetaItem[];
  lockStartIndex?: number;
  listed?: boolean;
  originalName?: string;
  localOrTranslated?: "local" | "translated";
}): Promise<Series> {
  const store = readStore();
  const now = Date.now();

  const cleanTitle = data.title.trim();
  const category = data.tags[0] ?? "Romance";

  const dramaId = assignDramaIdForTitle(cleanTitle);
  const baseId = slugify(cleanTitle) || `series-${Date.now()}`;
  const seriesId = `${baseId}-${Math.random().toString(16).slice(2, 6)}`;

  const cover = data.coverDataUrl || coverPlaceholder(cleanTitle, category);
  const poster = data.coverDataUrl
    ? data.coverDataUrl
    : posterPlaceholder(cleanTitle, data.description);

  const lockStart = data.lockStartIndex ?? 4;
  const total = Math.max(1, data.episodeVideoUrls.length);
  const episodes: Episode[] = Array.from({ length: total }).map((_, i) => {
    const index = i + 1;
    const videoUrl = data.episodeVideoUrls[i] ?? "";
    const meta = data.episodeVideoMeta?.[i];
    const fileName = meta?.fileName ?? "";
    const localVideoUrl =
      meta?.localVideoUrl?.trim() ||
      (fileName ? `file:///${fileName.replace(/\\/g, "/")}` : undefined);
    const isFree = index < lockStart;
    return {
      id: `${seriesId}-ep-${index}`,
      index,
      title: `第 ${index} 集`,
      duration: `${6 + (index % 3)}:${String((index * 7) % 60).padStart(2, "0")}`,
      thumbnail: episodeThumbPlaceholder(
        `第 ${index} 集`,
        isFree ? "FREE" : "LOCKED"
      ),
      videoUrl,
      isFree,
      sourceFileName: fileName || undefined,
      localVideoUrl
    };
  });

  const listed = data.listed !== false;

  const next: Series = {
    id: seriesId,
    title: cleanTitle,
    tagline: data.description.slice(0, 30) || "短剧简介",
    category,
    tags: data.tags,
    cover,
    poster,
    isTrending: true,
    isNew: true,
    description: data.description,
    episodes,
    lockStartIndex: lockStart,
    listed,
    dramaId,
    originalName: data.originalName,
    localOrTranslated: data.localOrTranslated,
    createdAt: now,
    completedAt: now,
    taskStatus: "completed",
    listedAt: listed ? now : undefined
  };

  store.series = [next, ...store.series];
  writeStore(store);
  return next;
}

export async function deleteSeries(id: string): Promise<void> {
  const store = readStore();
  store.series = store.series.filter((s) => s.id !== id);
  writeStore(store);
}

/** 从剧目中删除某一集并顺延重排集号（仅本地 JSON 存储完整支持） */
export async function deleteEpisodeFromSeries(
  seriesId: string,
  episodeId: string
): Promise<Series | null> {
  const store = readStore();
  const sIdx = store.series.findIndex((s) => s.id === seriesId);
  if (sIdx < 0) return null;
  const s = store.series[sIdx];
  if (!s.episodes?.some((e) => e.id === episodeId)) return null;

  const lockStart = s.lockStartIndex ?? 4;
  const filtered = s.episodes.filter((e) => e.id !== episodeId);
  const renumbered: Episode[] = filtered.map((e, i) => {
    const index = i + 1;
    return {
      ...e,
      id: `${seriesId}-ep-${index}`,
      index,
      title: `第 ${index} 集`,
      isFree: index < lockStart
    };
  });

  const next: Series = { ...s, episodes: renumbered };
  store.series[sIdx] = next;
  writeStore(store);
  return next;
}

export async function appendEpisodeToSeries(
  seriesId: string,
  data: {
    videoUrl: string;
    sourceFileName?: string;
    localVideoUrl?: string;
  }
): Promise<Series | null> {
  const store = readStore();
  const sIdx = store.series.findIndex((s) => s.id === seriesId);
  if (sIdx < 0) return null;
  const s = store.series[sIdx];
  const lockStart = s.lockStartIndex ?? 4;
  const nextIndex = (s.episodes?.length ?? 0) + 1;
  const isFree = nextIndex < lockStart;
  const newEp: Episode = {
    id: `${seriesId}-ep-${nextIndex}`,
    index: nextIndex,
    title: `第 ${nextIndex} 集`,
    duration: `${6 + (nextIndex % 3)}:${String((nextIndex * 7) % 60).padStart(2, "0")}`,
    thumbnail: episodeThumbPlaceholder(
      `第 ${nextIndex} 集`,
      isFree ? "FREE" : "LOCKED"
    ),
    videoUrl: data.videoUrl,
    isFree,
    sourceFileName: data.sourceFileName,
    localVideoUrl: data.localVideoUrl
  };
  const next: Series = {
    ...s,
    episodes: [...(s.episodes ?? []), newEp]
  };
  store.series[sIdx] = next;
  writeStore(store);
  return next;
}

export async function updateSeries(
  id: string,
  patch: {
    lockStartIndex?: number;
    title?: string;
    originalName?: string;
    localOrTranslated?: "local" | "translated";
    description?: string;
    tags?: Series["tags"];
    cover?: string;
    poster?: string;
    listed?: boolean;
  }
): Promise<Series | null> {
  const store = readStore();
  const idx = store.series.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  const prev = store.series[idx];
  const next: Series = { ...prev };

  if (patch.lockStartIndex !== undefined) next.lockStartIndex = patch.lockStartIndex;
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.originalName !== undefined) next.originalName = patch.originalName;
  if (patch.localOrTranslated !== undefined) next.localOrTranslated = patch.localOrTranslated;
  if (patch.description !== undefined) next.description = patch.description;
  if (patch.tags !== undefined) {
    next.tags = patch.tags;
    const first = patch.tags[0];
    if (first !== undefined) {
      next.category = first;
    }
  }
  if (patch.cover !== undefined) next.cover = patch.cover;
  if (patch.poster !== undefined) next.poster = patch.poster;

  if (patch.listed !== undefined) {
    next.listed = patch.listed;
    if (patch.listed && !prev.listed) next.listedAt = Date.now();
  }

  if (patch.lockStartIndex !== undefined && next.episodes) {
    next.episodes = next.episodes.map((e) => ({
      ...e,
      isFree: e.index < patch.lockStartIndex!
    }));
  }

  store.series[idx] = next;
  writeStore(store);
  return next;
}

