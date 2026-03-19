import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Series, Episode, CategoryTag } from "@/constants/mock-data";
import { SERIES_LIST } from "@/constants/mock-data";
import {
  episodeThumbPlaceholder,
  posterPlaceholder,
  slugify
} from "@/lib/admin/placeholders";

type StoredSeries = {
  id: string;
  title: string;
  description: string;
  category: CategoryTag;
  tagsJson: string;
  cover: string;
  poster: string;
  tagline: string;
  isTrending: 0 | 1;
  isNew: 0 | 1;
  createdAt: number;
};

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "series.sqlite");

let db: any | null = null;
let initialized = false;

function getDb() {
  if (!db) {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
  }
  return db;
}

function initIfNeeded() {
  if (initialized) return;
  const conn = getDb();

  conn.exec(`
    CREATE TABLE IF NOT EXISTS series (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      cover TEXT NOT NULL,
      poster TEXT NOT NULL,
      tagline TEXT NOT NULL,
      is_trending INTEGER NOT NULL DEFAULT 1,
      is_new INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      series_id TEXT NOT NULL,
      ep_index INTEGER NOT NULL,
      title TEXT NOT NULL,
      duration TEXT NOT NULL,
      thumbnail TEXT NOT NULL,
      video_url TEXT NOT NULL,
      is_free INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_episodes_series_id ON episodes(series_id);
  `);

  const count = conn.prepare("SELECT COUNT(1) as c FROM series").get() as { c: number };
  if (count.c === 0) {
    const seedSeries = SERIES_LIST;
    const insertSeries = conn.prepare(`
      INSERT INTO series (
        id, title, description, category, tags_json, cover, poster, tagline, is_trending, is_new, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertEpisode = conn.prepare(`
      INSERT INTO episodes (
        id, series_id, ep_index, title, duration, thumbnail, video_url, is_free
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now();
    const tx = conn.transaction(() => {
      for (const s of seedSeries) {
        insertSeries.run(
          s.id,
          s.title,
          s.description ?? s.tagline,
          s.category,
          JSON.stringify(s.tags),
          s.cover,
          s.poster,
          s.tagline,
          1,
          s.isNew ? 1 : 0,
          now
        );
        for (const e of s.episodes) {
          insertEpisode.run(
            e.id,
            s.id,
            e.index,
            e.title,
            e.duration,
            e.thumbnail,
            e.videoUrl,
            e.isFree ? 1 : 0
          );
        }
      }
    });
    tx();
  }

  initialized = true;
}

export async function getAllSeries(): Promise<Series[]> {
  initIfNeeded();
  const conn = getDb();

  const seriesRows = conn
    .prepare("SELECT * FROM series")
    .all() as Array<StoredSeries & { tags_json: string }>;

  const episodeRows = conn
    .prepare("SELECT * FROM episodes ORDER BY series_id, ep_index")
    .all();

  const grouped = new Map<string, Episode[]>();
  for (const row of episodeRows as Array<any>) {
    const eps = grouped.get(row.series_id) ?? [];
    eps.push({
      id: row.id,
      index: row.ep_index,
      title: row.title,
      duration: row.duration,
      thumbnail: row.thumbnail,
      videoUrl: row.video_url,
      isFree: row.is_free === 1
    } satisfies Episode);
    grouped.set(row.series_id, eps);
  }

  return (seriesRows as any[]).map((s) => {
    const tags = JSON.parse(s.tags_json) as Series["tags"];
    return {
      id: s.id,
      title: s.title,
      description: s.description,
      category: s.category as CategoryTag,
      tags,
      cover: s.cover,
      poster: s.poster,
      tagline: s.tagline,
      isTrending: s.is_trending === 1,
      isNew: s.is_new === 1,
      episodes: (grouped.get(s.id) ?? []).sort((a, b) => a.index - b.index)
    } satisfies Series;
  });
}

export async function getSeriesById(id: string): Promise<Series | null> {
  initIfNeeded();
  const conn = getDb();

  const s = conn.prepare("SELECT * FROM series WHERE id = ?").get(id) as
    | any
    | undefined;
  if (!s) return null;

  const episodeRows = conn
    .prepare("SELECT * FROM episodes WHERE series_id = ? ORDER BY ep_index")
    .all(id) as Array<any>;

  const tags = JSON.parse(s.tags_json) as Series["tags"];

  const episodes: Episode[] = episodeRows.map((e) => ({
    id: e.id,
    index: e.ep_index,
    title: e.title,
    duration: e.duration,
    thumbnail: e.thumbnail,
    videoUrl: e.video_url,
    isFree: e.is_free === 1
  }));

  return {
    id: s.id,
    title: s.title,
    description: s.description,
    category: s.category as CategoryTag,
    tags,
    cover: s.cover,
    poster: s.poster,
    tagline: s.tagline,
    isTrending: s.is_trending === 1,
    isNew: s.is_new === 1,
    episodes
  } satisfies Series;
}

export async function createSeries(data: {
  title: string;
  description: string;
  tags: Series["tags"];
  coverDataUrl: string;
  episodeVideoUrls: string[];
}): Promise<Series> {
  initIfNeeded();
  const conn = getDb();

  const cleanTitle = data.title.trim();
  const category = (data.tags[0] ?? ("Romance" as CategoryTag)) as CategoryTag;

  const baseId = slugify(cleanTitle) || `series-${Date.now()}`;
  const seriesId = `${baseId}-${Math.random().toString(16).slice(2, 6)}`;
  const now = Date.now();

  const cover = data.coverDataUrl;
  const poster = data.coverDataUrl || posterPlaceholder(cleanTitle, data.description);

  const isTrending = 1;
  const isNew = 1;

  const insertSeries = conn.prepare(`
    INSERT INTO series (
      id, title, description, category, tags_json, cover, poster, tagline, is_trending, is_new, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEpisode = conn.prepare(`
    INSERT INTO episodes (
      id, series_id, ep_index, title, duration, thumbnail, video_url, is_free
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const total = Math.max(1, data.episodeVideoUrls.length);
  const episodes: Episode[] = Array.from({ length: total }).map((_, i) => {
    const index = i + 1;
    const isFree = index <= 3;
    const videoUrl = data.episodeVideoUrls[i] ?? "";
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

  const tagline = data.description.slice(0, 30) || "短剧简介";
  const tx = conn.transaction(() => {
    insertSeries.run(
      seriesId,
      cleanTitle,
      data.description,
      category,
      JSON.stringify(data.tags),
      cover,
      poster,
      tagline,
      isTrending,
      isNew,
      now
    );
    for (const e of episodes) {
      insertEpisode.run(
        e.id,
        seriesId,
        e.index,
        e.title,
        e.duration,
        e.thumbnail,
        e.videoUrl,
        e.isFree ? 1 : 0
      );
    }
  });
  tx();

  return {
    id: seriesId,
    title: cleanTitle,
    description: data.description,
    category,
    tags: data.tags,
    cover,
    poster,
    tagline,
    isTrending: true,
    isNew: true,
    episodes
  } satisfies Series;
}

export async function deleteSeries(id: string): Promise<void> {
  initIfNeeded();
  const conn = getDb();
  conn.prepare("DELETE FROM series WHERE id = ?").run(id);
}

