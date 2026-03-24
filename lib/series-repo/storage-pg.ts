import { Pool } from "pg";
import { getDatabaseUrl } from "@/lib/db/url";
import type { Episode, Series } from "@/constants/mock-data";
import { SERIES_LIST } from "@/constants/mock-data";
import {
  episodeThumbPlaceholder,
  posterPlaceholder,
  slugify
} from "@/lib/admin/placeholders";
import type { EpisodeVideoMetaItem } from "./storage-local";

/** node-pg 对 JSONB 常返回已解析的数组，勿 String(arr) 再 JSON.parse（会得到 "A,B" 而报错） */
function tagsFromPgJsonb(raw: unknown): Series["tags"] {
  if (raw == null) return [] as Series["tags"];
  if (Array.isArray(raw)) return raw as Series["tags"];
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [] as Series["tags"];
    try {
      return JSON.parse(t) as Series["tags"];
    } catch {
      return [] as Series["tags"];
    }
  }
  return [] as Series["tags"];
}

type StoredEpisodeRow = {
  id: string;
  series_id: string;
  ep_index: number;
  title: string;
  duration: string;
  thumbnail: string;
  video_url: string;
  is_free: number;
  source_file_name?: string | null;
  local_video_url?: string | null;
  video_stream_id?: string | null;
  video_playback_url?: string | null;
  video_status?: string | null;
};

function mapEpisodeRow(er: StoredEpisodeRow): Episode {
  return {
    id: er.id,
    index: er.ep_index,
    title: er.title,
    duration: er.duration,
    thumbnail: er.thumbnail,
    videoUrl: er.video_url,
    isFree: er.is_free === 1,
    sourceFileName: er.source_file_name ?? undefined,
    localVideoUrl: er.local_video_url ?? undefined,
    videoStreamId: er.video_stream_id ?? undefined,
    videoPlaybackUrl: er.video_playback_url ?? undefined,
    videoStatus:
      (er.video_status as "processing" | "ready" | "failed" | undefined) ?? undefined
  };
}

function mapPgRowToSeries(s: Record<string, unknown>, episodes: Episode[]): Series {
  const listedRaw = s.listed;
  const listed =
    listedRaw === undefined || listedRaw === null ? true : Number(listedRaw) === 1;
  return {
    id: s.id as string,
    title: s.title as string,
    description: (s.description as string) ?? "",
    category: s.category as string,
    tags: tagsFromPgJsonb(s.tags_json),
    cover: s.cover as string,
    poster: s.poster as string,
    tagline: s.tagline as string,
    isTrending: Number(s.is_trending) === 1,
    isNew: Number(s.is_new) === 1,
    episodes,
    dramaId: s.drama_id != null ? Number(s.drama_id) : undefined,
    originalName: (s.original_name as string) || undefined,
    localOrTranslated:
      (s.local_or_translated as Series["localOrTranslated"]) || undefined,
    lockStartIndex:
      s.lock_start_index != null ? Number(s.lock_start_index) : 4,
    listed,
    createdAt: s.created_at != null ? Number(s.created_at) : undefined,
    completedAt: s.completed_at != null ? Number(s.completed_at) : undefined,
    listedAt: s.listed_at != null ? Number(s.listed_at) : undefined,
    taskStatus: (s.task_status as Series["taskStatus"]) || undefined
  };
}

let pool: Pool | null = null;
let initialized = false;

async function allocateDramaId(conn: Pool): Promise<number> {
  // Use a transaction-scoped advisory lock to avoid duplicate drama_id under concurrency.
  await conn.query("SELECT pg_advisory_xact_lock($1)", [2026031901]);
  const { rows } = await conn.query(
    "SELECT COALESCE(MAX(drama_id), 9999) + 1 AS next_id FROM series"
  );
  const next = Number(rows?.[0]?.next_id ?? 10000);
  return Number.isFinite(next) && next >= 10000 ? next : 10000;
}

function getPool() {
  if (pool) return pool;
  const url = getDatabaseUrl();
  if (!url) {
    // 构建/类型检查阶段不应失败；运行时才会触发
    throw new Error(
      "Missing DATABASE_URL / SUPABASE_DB_URL / PG_URL for SERIES_STORAGE=pg"
    );
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
      created_at BIGINT NOT NULL
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

  await conn.query(`
    ALTER TABLE series ADD COLUMN IF NOT EXISTS drama_id BIGINT;
    ALTER TABLE series ADD COLUMN IF NOT EXISTS original_name TEXT;
    ALTER TABLE series ADD COLUMN IF NOT EXISTS local_or_translated TEXT;
    ALTER TABLE series ADD COLUMN IF NOT EXISTS lock_start_index INTEGER NOT NULL DEFAULT 4;
    ALTER TABLE series ADD COLUMN IF NOT EXISTS listed SMALLINT NOT NULL DEFAULT 1;
    ALTER TABLE series ADD COLUMN IF NOT EXISTS completed_at BIGINT;
    ALTER TABLE series ADD COLUMN IF NOT EXISTS listed_at BIGINT;
    ALTER TABLE series ADD COLUMN IF NOT EXISTS task_status TEXT;
    ALTER TABLE episodes ADD COLUMN IF NOT EXISTS source_file_name TEXT;
    ALTER TABLE episodes ADD COLUMN IF NOT EXISTS local_video_url TEXT;
    ALTER TABLE episodes ADD COLUMN IF NOT EXISTS video_stream_id TEXT;
    ALTER TABLE episodes ADD COLUMN IF NOT EXISTS video_playback_url TEXT;
    ALTER TABLE episodes ADD COLUMN IF NOT EXISTS video_status TEXT;
  `);

  await conn.query(`
    UPDATE series SET completed_at = created_at WHERE completed_at IS NULL;
    UPDATE series SET listed_at = created_at WHERE listed_at IS NULL AND listed <> 0;
  `);

  // 旧库曾用 INTEGER 存 created_at；JS Date.now() 毫秒值超过 INT4 上限，需 BIGINT
  await conn.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'series'
          AND column_name = 'created_at'
          AND data_type = 'integer'
      ) THEN
        ALTER TABLE series
          ALTER COLUMN created_at TYPE BIGINT USING created_at::bigint;
      END IF;
    END $$;
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
            id, series_id, ep_index, title, duration, thumbnail, video_url, is_free,
            source_file_name, local_video_url, video_stream_id, video_playback_url, video_status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
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
            e.isFree ? 1 : 0,
            e.sourceFileName ?? null,
            e.localVideoUrl ?? null,
            e.videoStreamId ?? null,
            e.videoPlaybackUrl ?? e.videoUrl,
            e.videoStatus ?? "ready"
          ]
        );
      }
    }
  }

  await conn.query(`
    WITH base AS (
      SELECT COALESCE(MAX(drama_id), 9999) AS max_id
      FROM series
      WHERE drama_id IS NOT NULL
    ),
    missing AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
      FROM series
      WHERE drama_id IS NULL
    )
    UPDATE series s
    SET drama_id = base.max_id + missing.rn
    FROM base, missing
    WHERE s.id = missing.id;
  `);

  initialized = true;
}

export async function getAllSeries(): Promise<Series[]> {
  await initIfNeeded();
  const conn = getPool();

  const seriesRes = await conn.query(
    "SELECT * FROM series ORDER BY created_at DESC"
  );
  const seriesRows = (seriesRes.rows ?? []) as Record<string, unknown>[];

  const episodeRes = await conn.query(
    "SELECT * FROM episodes ORDER BY series_id, ep_index"
  );

  const grouped = new Map<string, Episode[]>();
  for (const er of (episodeRes.rows ?? []) as StoredEpisodeRow[]) {
    const eps = grouped.get(er.series_id) ?? [];
    eps.push(mapEpisodeRow(er));
    grouped.set(er.series_id, eps);
  }

  return seriesRows.map((s) =>
    mapPgRowToSeries(s, (grouped.get(s.id as string) ?? []).sort((a, b) => a.index - b.index))
  );
}

export async function getSeriesById(id: string): Promise<Series | null> {
  await initIfNeeded();
  const conn = getPool();

  const sRes = await conn.query("SELECT * FROM series WHERE id = $1", [id]);
  const s = (sRes.rows?.[0] ?? null) as Record<string, unknown> | null;
  if (!s) return null;

  const eRes = await conn.query(
    "SELECT * FROM episodes WHERE series_id = $1 ORDER BY ep_index",
    [id]
  );

  const episodes: Episode[] = (eRes.rows ?? []).map((e: StoredEpisodeRow) =>
    mapEpisodeRow(e)
  );

  return mapPgRowToSeries(s as unknown as Record<string, unknown>, episodes);
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
  await initIfNeeded();
  const conn = getPool();

  const cleanTitle = data.title.trim();
  const category = data.tags[0] ?? "Romance";

  const baseId = slugify(cleanTitle) || `series-${Date.now()}`;
  const seriesId = `${baseId}-${Math.random().toString(16).slice(2, 6)}`;
  const now = Date.now();

  const lockStart = data.lockStartIndex ?? 4;
  const listed = data.listed !== false ? 1 : 0;

  const cover = data.coverDataUrl;
  const poster = data.coverDataUrl || posterPlaceholder(cleanTitle, data.description);

  const tagline = data.description.slice(0, 30) || "短剧简介";
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

  await conn.query("BEGIN");
  try {
    const dramaId = await allocateDramaId(conn);
    await conn.query(
      `
      INSERT INTO series (
        id, title, description, category, tags_json, cover, poster, tagline, is_trending, is_new, created_at,
        drama_id, original_name, local_or_translated, lock_start_index, listed, completed_at, listed_at, task_status
      ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
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
        now,
        dramaId,
        data.originalName ?? null,
        data.localOrTranslated ?? null,
        lockStart,
        listed,
        now,
        listed ? now : null,
        "completed"
      ]
    );

    for (const e of episodes) {
      await conn.query(
        `
          INSERT INTO episodes (
            id, series_id, ep_index, title, duration, thumbnail, video_url, is_free, source_file_name, local_video_url,
            video_stream_id, video_playback_url, video_status
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        `,
        [
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
        ]
      );
    }

    await conn.query("COMMIT");
    return mapPgRowToSeries(
      {
        id: seriesId,
        title: cleanTitle,
        description: data.description,
        category,
        tags_json: data.tags,
        cover,
        poster,
        tagline,
        is_trending: 1,
        is_new: 1,
        drama_id: dramaId,
        original_name: data.originalName,
        local_or_translated: data.localOrTranslated,
        lock_start_index: lockStart,
        listed,
        created_at: now,
        completed_at: now,
        listed_at: listed ? now : null,
        task_status: "completed"
      },
      episodes
    );
  } catch (err) {
    await conn.query("ROLLBACK");
    throw err;
  }
}

export async function deleteSeries(id: string): Promise<void> {
  await initIfNeeded();
  const conn = getPool();
  await conn.query("DELETE FROM series WHERE id = $1", [id]);
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
  await initIfNeeded();
  const conn = getPool();

  const cur = await getSeriesById(id);
  if (!cur) return null;

  const parts: string[] = [];
  const vals: unknown[] = [];
  let p = 1;

  const push = (col: string, val: unknown) => {
    parts.push(`${col} = $${p++}`);
    vals.push(val);
  };

  if (patch.title !== undefined) push("title", patch.title);
  if (patch.originalName !== undefined) {
    push("original_name", patch.originalName.trim() ? patch.originalName : null);
  }
  if (patch.localOrTranslated !== undefined) {
    push("local_or_translated", patch.localOrTranslated ?? null);
  }
  if (patch.description !== undefined) {
    push("description", patch.description);
    push("tagline", patch.description.slice(0, 30) || "短剧简介");
  }
  if (patch.tags !== undefined) {
    push("tags_json", JSON.stringify(patch.tags));
    const category = patch.tags[0] ?? "Romance";
    push("category", category);
  }
  if (patch.cover !== undefined) push("cover", patch.cover);
  if (patch.poster !== undefined) push("poster", patch.poster);
  if (patch.lockStartIndex !== undefined) push("lock_start_index", patch.lockStartIndex);

  if (patch.listed !== undefined) {
    push("listed", patch.listed ? 1 : 0);
    if (patch.listed && cur.listed === false) {
      push("listed_at", Date.now());
    }
  }

  await conn.query("BEGIN");
  try {
    if (parts.length > 0) {
      vals.push(id);
      await conn.query(`UPDATE series SET ${parts.join(", ")} WHERE id = $${p}`, vals);
    }

    if (patch.lockStartIndex !== undefined) {
      await conn.query(
        `UPDATE episodes SET is_free = CASE WHEN ep_index < $1 THEN 1 ELSE 0 END WHERE series_id = $2`,
        [patch.lockStartIndex, id]
      );
    }

    await conn.query("COMMIT");
  } catch (err) {
    await conn.query("ROLLBACK");
    throw err;
  }

  return getSeriesById(id);
}

export async function deleteEpisodeFromSeries(
  seriesId: string,
  episodeId: string
): Promise<Series | null> {
  await initIfNeeded();
  const conn = getPool();
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

  await conn.query("BEGIN");
  try {
    await conn.query("DELETE FROM episodes WHERE series_id = $1", [seriesId]);
    for (const e of renumbered) {
      await conn.query(
        `
        INSERT INTO episodes (
          id, series_id, ep_index, title, duration, thumbnail, video_url, is_free, source_file_name, local_video_url,
          video_stream_id, video_playback_url, video_status
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `,
        [
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
        ]
      );
    }
    await conn.query("COMMIT");
  } catch (err) {
    await conn.query("ROLLBACK");
    throw err;
  }

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
  await initIfNeeded();
  const conn = getPool();
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

  await conn.query(
    `
    INSERT INTO episodes (
      id, series_id, ep_index, title, duration, thumbnail, video_url, is_free, source_file_name, local_video_url,
      video_stream_id, video_playback_url, video_status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
  `,
    [
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
    ]
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
  await initIfNeeded();
  const conn = getPool();
  await conn.query(
    `
    UPDATE episodes
    SET
      video_stream_id = COALESCE($1, video_stream_id),
      video_playback_url = COALESCE($2, video_playback_url),
      video_status = COALESCE($3, video_status)
    WHERE series_id = $4 AND id = $5
  `,
    [
      patch.videoStreamId ?? null,
      patch.videoPlaybackUrl ?? null,
      patch.videoStatus ?? null,
      seriesId,
      episodeId
    ]
  );
  return getSeriesById(seriesId);
}

