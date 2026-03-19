import { Pool } from "pg";
import type { CategoryTag, Episode, Series } from "@/constants/mock-data";
import { SERIES_LIST } from "@/constants/mock-data";
import {
  episodeThumbPlaceholder,
  posterPlaceholder,
  slugify
} from "@/lib/admin/placeholders";

type StoredSeriesRow = {
  id: string;
  title: string;
  description: string;
  category: CategoryTag;
  tags_json: string;
  cover: string;
  poster: string;
  tagline: string;
  is_trending: number;
  is_new: number;
  created_at: number;
};

type StoredEpisodeRow = {
  id: string;
  series_id: string;
  ep_index: number;
  title: string;
  duration: string;
  thumbnail: string;
  video_url: string;
  is_free: number;
};

let pool: Pool | null = null;
let initialized = false;

function getPool() {
  if (pool) return pool;
  const url = process.env.PG_URL ?? process.env.DATABASE_URL;
  if (!url) {
    // 构建/类型检查阶段不应失败；运行时才会触发
    throw new Error("Missing PG_URL/DATABASE_URL for SERIES_STORAGE=pg");
  }
  pool = new Pool({
    connectionString: url,
    ssl:
      url.includes("localhost") || url.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false }
  });
  return pool;
}

async function initIfNeeded() {
  if (initialized) return;
  const conn = getPool();

  await conn.query(`
    CREATE TABLE IF NOT EXISTS series (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      tags_json JSONB NOT NULL,
      cover TEXT NOT NULL,
      poster TEXT NOT NULL,
      tagline TEXT NOT NULL,
      is_trending INTEGER NOT NULL DEFAULT 1,
      is_new INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
      ep_index INTEGER NOT NULL,
      title TEXT NOT NULL,
      duration TEXT NOT NULL,
      thumbnail TEXT NOT NULL,
      video_url TEXT NOT NULL,
      is_free INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_episodes_series_id ON episodes(series_id);
  `);

  // seed if empty
  const { rows } = await conn.query("SELECT COUNT(1) as c FROM series");
  const c = Number(rows[0]?.c ?? 0);
  if (c === 0) {
    const now = Date.now();
    for (const s of SERIES_LIST) {
      await conn.query(
        `
        INSERT INTO series (
          id, title, description, category, tags_json, cover, poster, tagline, is_trending, is_new, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO NOTHING
      `,
        [
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
        ]
      );
      for (const e of s.episodes) {
        await conn.query(
          `
          INSERT INTO episodes (
            id, series_id, ep_index, title, duration, thumbnail, video_url, is_free
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (id) DO NOTHING
        `,
          [
            e.id,
            s.id,
            e.index,
            e.title,
            e.duration,
            e.thumbnail,
            e.videoUrl,
            e.isFree ? 1 : 0
          ]
        );
      }
    }
  }

  initialized = true;
}

export async function getAllSeries(): Promise<Series[]> {
  await initIfNeeded();
  const conn = getPool();

  const seriesRes = await conn.query(
    "SELECT * FROM series ORDER BY created_at DESC"
  );
  const seriesRows = (seriesRes.rows ?? []) as StoredSeriesRow[];

  const episodeRes = await conn.query(
    "SELECT * FROM episodes ORDER BY series_id, ep_index"
  );

  const grouped = new Map<string, Episode[]>();
  for (const er of (episodeRes.rows ?? []) as StoredEpisodeRow[]) {
    const eps = grouped.get(er.series_id) ?? [];
    eps.push({
      id: er.id,
      index: er.ep_index,
      title: er.title,
      duration: er.duration,
      thumbnail: er.thumbnail,
      videoUrl: er.video_url,
      isFree: er.is_free === 1
    } satisfies Episode);
    grouped.set(er.series_id, eps);
  }

  return seriesRows.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    category: s.category,
    tags: JSON.parse(String(s.tags_json ?? "[]")) as Series["tags"],
    cover: s.cover,
    poster: s.poster,
    tagline: s.tagline,
    isTrending: s.is_trending === 1,
    isNew: s.is_new === 1,
    episodes: (grouped.get(s.id) ?? []).sort((a, b) => a.index - b.index)
  })) as Series[];
}

export async function getSeriesById(id: string): Promise<Series | null> {
  await initIfNeeded();
  const conn = getPool();

  const sRes = await conn.query("SELECT * FROM series WHERE id = $1", [id]);
  const s = (sRes.rows?.[0] ?? null) as StoredSeriesRow | null;
  if (!s) return null;

  const eRes = await conn.query(
    "SELECT * FROM episodes WHERE series_id = $1 ORDER BY ep_index",
    [id]
  );

  const episodes: Episode[] = (eRes.rows ?? []).map((e: StoredEpisodeRow) => ({
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
    category: s.category,
    tags: JSON.parse(String(s.tags_json ?? "[]")) as Series["tags"],
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
  await initIfNeeded();
  const conn = getPool();

  const cleanTitle = data.title.trim();
  const category = (data.tags[0] ?? ("Romance" as CategoryTag)) as CategoryTag;

  const baseId = slugify(cleanTitle) || `series-${Date.now()}`;
  const seriesId = `${baseId}-${Math.random().toString(16).slice(2, 6)}`;
  const now = Date.now();

  // cover / poster: 与 local/sqlite 保持一致逻辑（coverDataUrl 作为展示素材）
  const cover = data.coverDataUrl;
  const poster = data.coverDataUrl || posterPlaceholder(cleanTitle, data.description);

  const tagline = data.description.slice(0, 30) || "短剧简介";
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

  await conn.query("BEGIN");
  try {
    await conn.query(
      `
      INSERT INTO series (
        id, title, description, category, tags_json, cover, poster, tagline, is_trending, is_new, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `,
      [
        seriesId,
        cleanTitle,
        data.description,
        category,
        JSON.stringify(data.tags),
        cover,
        poster,
        tagline,
        1,
        1,
        now
      ]
    );

    for (const e of episodes) {
      await conn.query(
        `
          INSERT INTO episodes (
            id, series_id, ep_index, title, duration, thumbnail, video_url, is_free
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `,
        [
          e.id,
          seriesId,
          e.index,
          e.title,
          e.duration,
          e.thumbnail,
          e.videoUrl,
          e.isFree ? 1 : 0
        ]
      );
    }

    await conn.query("COMMIT");
  } catch (err) {
    await conn.query("ROLLBACK");
    throw err;
  }

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
  await initIfNeeded();
  const conn = getPool();
  await conn.query("DELETE FROM series WHERE id = $1", [id]);
}

