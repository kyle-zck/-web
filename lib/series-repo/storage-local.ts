import fs from "fs";
import path from "path";
import type { Series, Episode, CategoryTag } from "@/constants/mock-data";
import { SERIES_LIST } from "@/constants/mock-data";
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

export async function createSeries(data: {
  title: string;
  description: string;
  tags: Series["tags"];
  coverDataUrl: string;
  episodeVideoUrls: string[];
}): Promise<Series> {
  const store = readStore();

  const cleanTitle = data.title.trim();
  const category = (data.tags[0] ?? ("Romance" as CategoryTag)) as CategoryTag;

  const baseId = slugify(cleanTitle) || `series-${Date.now()}`;
  const seriesId = `${baseId}-${Math.random().toString(16).slice(2, 6)}`;

  const cover = data.coverDataUrl || coverPlaceholder(cleanTitle, category);
  const poster = data.coverDataUrl
    ? data.coverDataUrl
    : posterPlaceholder(cleanTitle, data.description);

  const total = Math.max(1, data.episodeVideoUrls.length);
  const episodes: Episode[] = Array.from({ length: total }).map((_, i) => {
    const index = i + 1;
    const videoUrl = data.episodeVideoUrls[i] ?? "";
    const isFree = index <= 3;
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
      isFree
    };
  });

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
    episodes
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

