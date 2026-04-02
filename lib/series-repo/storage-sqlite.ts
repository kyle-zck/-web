import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Series, Episode } from "@/constants/mock-data";
import { SERIES_LIST } from "@/constants/mock-data";
import {
  episodeThumbPlaceholder,
  posterPlaceholder,
  slugify
} from "@/lib/admin/placeholders";
import { assignDramaIdForTitle } from "@/lib/drama-id-registry";
import type { EpisodeVideoMetaItem } from "./storage-local";

type StoredSeries = {
  id: string;
  title: string;
  description: string;
  category: string;
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
    db.pragma("foreign_keys = ON");
  }
  return db;
}

function sqliteAddColumn(conn: any, table: string, col: string, sqlType: string) {
  const rows = conn.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (rows.some((r) => r.name === col)) return;
  conn.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${sqlType}`);
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

  sqliteAddColumn(conn, "series", "drama_id", "INTEGER");
  sqliteAddColumn(conn, "series", "original_name", "TEXT");
  sqliteAddColumn(conn, "series", "local_or_translated", "TEXT");
  sqliteAddColumn(conn, "series", "lock_start_index", "INTEGER NOT NULL DEFAULT 4");
  sqliteAddColumn(conn, "series", "listed", "INTEGER NOT NULL DEFAULT 1");
  sqliteAddColumn(conn, "series", "completed_at", "INTEGER");
  sqliteAddColumn(conn, "series", "listed_at", "INTEGER");
  sqliteAddColumn(conn, "series", "task_status", "TEXT");
  sqliteAddColumn(conn, "episodes", "source_file_name", "TEXT");
  sqliteAddColumn(conn, "episodes", "local_video_url", "TEXT");
  sqliteAddColumn(conn, "episodes", "video_stream_id", "TEXT");
  sqliteAddColumn(conn, "episodes", "video_playback_url", "TEXT");
  sqliteAddColumn(conn, "episodes", "video_status", "TEXT");

  const missingDrama = conn
    .prepare("SELECT id, title FROM series WHERE drama_id IS NULL")
    .all() as { id: string; title: string }[];
  for (const r of missingDrama) {
    const did = assignDramaIdForTitle(r.title);
    conn.prepare("UPDATE series SET drama_id = ? WHERE id = ?").run(did, r.id);
  }
  conn
    .prepare("UPDATE series SET completed_at = created_at WHERE completed_at IS NULL")
    .run();
  conn
    .prepare("UPDATE series SET listed_at = created_at WHERE listed_at IS NULL AND listed <> 0")
    .run();

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
        id, series_id, ep_index, title, duration, thumbnail, video_url, is_free,
        source_file_name, local_video_url, video_stream_id, video_playback_url, video_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            e.isFree ? 1 : 0,
            e.sourceFileName ?? null,
            e.localVideoUrl ?? null,
            e.videoStreamId ?? null,
            e.videoPlaybackUrl ?? e.videoUrl,
            e.videoStatus ?? "ready"
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
      isFree: row.is_free === 1,
      sourceFileName: row.source_file_name || undefined,
      localVideoUrl: row.local_video_url || undefined,
      videoStreamId: row.video_stream_id || undefined,
      videoPlaybackUrl: row.video_playback_url || undefined,
      videoStatus: row.video_status || undefined
    } satisfies Episode);
    grouped.set(row.series_id, eps);
  }

  return (seriesRows as any[]).map((s) =>
    mapSqliteSeriesRow(s, (grouped.get(s.id) ?? []).sort((a, b) => a.index - b.index))
  );
}

function mapSqliteSeriesRow(s: any, episodes: Episode[]): Series {
  const listed = s.listed === undefined || s.listed === null ? true : s.listed === 1;
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    category: s.category,
    tags: JSON.parse(s.tags_json) as Series["tags"],
    cover: s.cover,
    poster: s.poster,
    tagline: s.tagline,
    isTrending: s.is_trending === 1,
    isNew: s.is_new === 1,
    episodes,
    dramaId: s.drama_id != null ? Number(s.drama_id) : undefined,
    originalName: s.original_name || undefined,
    localOrTranslated: s.local_or_translated || undefined,
    lockStartIndex: s.lock_start_index != null ? s.lock_start_index : 4,
    listed,
    createdAt: s.created_at,
    completedAt: s.completed_at ?? undefined,
    listedAt: s.listed_at ?? undefined,
    taskStatus: s.task_status || undefined
  };
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

  const episodes: Episode[] = episodeRows.map((e) => ({
    id: e.id,
    index: e.ep_index,
    title: e.title,
    duration: e.duration,
    thumbnail: e.thumbnail,
    videoUrl: e.video_url,
    isFree: e.is_free === 1,
    sourceFileName: e.source_file_name || undefined,
    localVideoUrl: e.local_video_url || undefined,
    videoStreamId: e.video_stream_id || undefined,
    videoPlaybackUrl: e.video_playback_url || undefined,
    videoStatus: e.video_status || undefined
  }));

  return mapSqliteSeriesRow(s, episodes);
}

export async function createSeries(data: {
  title: string;
  description: string;
  tags: Series["tags"];
  coverDataUrl: string;
  episodeVideoUrls: string[];
  episodeVideoMeta?: EpisodeVideoMetaItem[];
  lockStartIndex?: number;
  listed?: boolean;
  originalName?: string;
  localOrTranslated?: "local" | "translated";
}): Promise<Series> {
  initIfNeeded();
  const conn = getDb();

  const cleanTitle = data.title.trim();
  const category = data.tags[0] ?? "Romance";
  const dramaId = assignDramaIdForTitle(cleanTitle);

  const baseId = slugify(cleanTitle) || `series-${Date.now()}`;
  const seriesId = `${baseId}-${Math.random().toString(16).slice(2, 6)}`;
  const now = Date.now();

  const cover = data.coverDataUrl;
  const poster = data.coverDataUrl || posterPlaceholder(cleanTitle, data.description);

  const isTrending = 1;
  const isNew = 1;
  const lockStart = data.lockStartIndex ?? 4;
  const listed = data.listed !== false ? 1 : 0;

  const insertSeries = conn.prepare(`
    INSERT INTO series (
      id, title, description, category, tags_json, cover, poster, tagline, is_trending, is_new, created_at,
      drama_id, original_name, local_or_translated, lock_start_index, listed, completed_at, listed_at, task_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertEpisode = conn.prepare(`
    INSERT INTO episodes (
      id, series_id, ep_index, title, duration, thumbnail, video_url, is_free, source_file_name, local_video_url,
      video_stream_id, video_playback_url, video_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const total = Math.max(1, data.episodeVideoUrls.length);
  const episodes: Episode[] = Array.from({ length: total }).map((_, i) => {
    const index = i + 1;
    const isFree = index < lockStart;
    const videoUrl = data.episodeVideoUrls[i] ?? "";
    const meta = data.episodeVideoMeta?.[i];
    const fileName = meta?.fileName ?? "";
    const localVideoUrl =
      meta?.localVideoUrl?.trim() ||
      (fileName ? `file:///${fileName.replace(/\\/g, "/")}` : undefined);
    const videoPlaybackUrl = meta?.videoPlaybackUrl?.trim() || videoUrl;
    const videoStatus = meta?.videoStatus ?? "ready";
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
      localVideoUrl,
      videoStreamId: meta?.videoStreamId,
      videoPlaybackUrl,
      videoStatus
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
      now,
      dramaId,
      data.originalName ?? null,
      data.localOrTranslated ?? null,
      lockStart,
      listed,
      now,
      listed ? now : null,
      "completed"
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
        e.isFree ? 1 : 0,
        e.sourceFileName ?? null,
        e.localVideoUrl ?? null,
        e.videoStreamId ?? null,
        e.videoPlaybackUrl ?? e.videoUrl,
        e.videoStatus ?? "ready"
      );
    }
  });
  tx();

  const row = conn.prepare("SELECT * FROM series WHERE id = ?").get(seriesId);
  return mapSqliteSeriesRow(row, episodes);
}

export async function deleteSeries(id: string): Promise<void> {
  initIfNeeded();
  const conn = getDb();
  conn.prepare("DELETE FROM series WHERE id = ?").run(id);
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
  initIfNeeded();
  const conn = getDb();

  const cur = await getSeriesById(id);
  if (!cur) return null;

  const fields: string[] = [];
  const vals: unknown[] = [];

  if (patch.title !== undefined) {
    fields.push("title = ?");
    vals.push(patch.title);
  }
  if (patch.originalName !== undefined) {
    fields.push("original_name = ?");
    vals.push(patch.originalName.trim() ? patch.originalName : null);
  }
  if (patch.localOrTranslated !== undefined) {
    fields.push("local_or_translated = ?");
    vals.push(patch.localOrTranslated ?? null);
  }
  if (patch.description !== undefined) {
    fields.push("description = ?");
    vals.push(patch.description);
    fields.push("tagline = ?");
    vals.push(patch.description.slice(0, 30) || "短剧简介");
  }
  if (patch.tags !== undefined) {
    fields.push("tags_json = ?");
    vals.push(JSON.stringify(patch.tags));
    fields.push("category = ?");
    vals.push(patch.tags[0] ?? "Romance");
  }
  if (patch.cover !== undefined) {
    fields.push("cover = ?");
    vals.push(patch.cover);
  }
  if (patch.poster !== undefined) {
    fields.push("poster = ?");
    vals.push(patch.poster);
  }
  if (patch.lockStartIndex !== undefined) {
    fields.push("lock_start_index = ?");
    vals.push(patch.lockStartIndex);
  }
  if (patch.listed !== undefined) {
    fields.push("listed = ?");
    vals.push(patch.listed ? 1 : 0);
    if (patch.listed && cur.listed === false) {
      fields.push("listed_at = ?");
      vals.push(Date.now());
    }
  }

  const tx = conn.transaction(() => {
    if (fields.length > 0) {
      vals.push(id);
      conn
        .prepare(`UPDATE series SET ${fields.join(", ")} WHERE id = ?`)
        .run(...vals);
    }
    if (patch.lockStartIndex !== undefined) {
      conn
        .prepare(
          `UPDATE episodes SET is_free = CASE WHEN ep_index < ? THEN 1 ELSE 0 END WHERE series_id = ?`
        )
        .run(patch.lockStartIndex, id);
    }
  });
  tx();

  return getSeriesById(id);
}

export async function deleteEpisodeFromSeries(
  seriesId: string,
  episodeId: string
): Promise<Series | null> {
  initIfNeeded();
  const conn = getDb();
  const s = await getSeriesById(seriesId);
  if (!s?.episodes?.length) return null;
  if (!s.episodes.some((e) => e.id === episodeId)) return null;

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

  const tx = conn.transaction(() => {
    conn.prepare("DELETE FROM episodes WHERE series_id = ?").run(seriesId);
    const ins = conn.prepare(`
      INSERT INTO episodes (
        id, series_id, ep_index, title, duration, thumbnail, video_url, is_free, source_file_name, local_video_url,
        video_stream_id, video_playback_url, video_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const e of renumbered) {
      ins.run(
        e.id,
        seriesId,
        e.index,
        e.title,
        e.duration,
        e.thumbnail,
        e.videoUrl,
        e.isFree ? 1 : 0,
        e.sourceFileName ?? null,
        e.localVideoUrl ?? null,
        e.videoStreamId ?? null,
        e.videoPlaybackUrl ?? e.videoUrl,
        e.videoStatus ?? "ready"
      );
    }
  });
  tx();

  return getSeriesById(seriesId);
}

export async function appendEpisodeToSeries(
  seriesId: string,
  data: {
    videoUrl: string;
    sourceFileName?: string;
    localVideoUrl?: string;
    videoStreamId?: string;
    videoPlaybackUrl?: string;
    videoStatus?: "processing" | "ready" | "failed";
  }
): Promise<Series | null> {
  initIfNeeded();
  const conn = getDb();
  const s = await getSeriesById(seriesId);
  if (!s) return null;

  const lockStart = s.lockStartIndex ?? 4;
  const nextIndex = (s.episodes?.length ?? 0) + 1;
  const isFree = nextIndex < lockStart;
  const ep: Episode = {
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
    localVideoUrl: data.localVideoUrl,
    videoStreamId: data.videoStreamId,
    videoPlaybackUrl: data.videoPlaybackUrl ?? data.videoUrl,
    videoStatus: data.videoStatus ?? "ready"
  };

  conn
    .prepare(`
      INSERT INTO episodes (
        id, series_id, ep_index, title, duration, thumbnail, video_url, is_free, source_file_name, local_video_url,
        video_stream_id, video_playback_url, video_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      ep.id,
      seriesId,
      ep.index,
      ep.title,
      ep.duration,
      ep.thumbnail,
      ep.videoUrl,
      ep.isFree ? 1 : 0,
      ep.sourceFileName ?? null,
      ep.localVideoUrl ?? null,
      ep.videoStreamId ?? null,
      ep.videoPlaybackUrl ?? ep.videoUrl,
      ep.videoStatus ?? "ready"
    );

  return getSeriesById(seriesId);
}

export async function updateEpisodeStreamState(
  seriesId: string,
  episodeId: string,
  patch: {
    videoStreamId?: string;
    videoPlaybackUrl?: string;
    videoStatus?: "processing" | "ready" | "failed";
  }
): Promise<Series | null> {
  initIfNeeded();
  const conn = getDb();
  conn
    .prepare(
      `
      UPDATE episodes
      SET
        video_stream_id = COALESCE(?, video_stream_id),
        video_playback_url = COALESCE(?, video_playback_url),
        video_status = COALESCE(?, video_status)
      WHERE series_id = ? AND id = ?
    `
    )
    .run(
      patch.videoStreamId ?? null,
      patch.videoPlaybackUrl ?? null,
      patch.videoStatus ?? null,
      seriesId,
      episodeId
    );
  return getSeriesById(seriesId);
}

