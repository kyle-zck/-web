import { Pool } from "pg";
import { getDatabaseUrl } from "@/lib/db/url";
import type { RechargeRecord, StoredUser, WatchHistoryEntry } from "./types";

type RechargeRow = {
  id: string;
  uid: string;
  date: string;
  price: string | number;
  tier: string;
  created_at: Date;
};

function mapRechargeRow(row: RechargeRow): RechargeRecord {
  return {
    id: row.id,
    uid: row.uid,
    date: row.date,
    price: Number(row.price),
    tier: row.tier,
    createdAt: row.created_at.toISOString()
  };
}

type WatchHistoryRow = {
  series_id: string;
  episode_index: number;
  seconds: number;
  last_watched_at: Date;
};

type WatchHistoryFullRow = WatchHistoryRow & { client_id: string };

type FavoritePairRow = { client_id: string; series_id: string };

let pool: Pool | null = null;
let initialized = false;

function getPool(): Pool {
  if (pool) return pool;
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("Missing DATABASE_URL / SUPABASE_DB_URL / PG_URL for user storage (pg)");
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

function randomUid(): string {
  return String(Math.floor(100000000 + Math.random() * 900000000));
}

async function initIfNeeded() {
  if (initialized) return;
  const conn = getPool();
  await conn.query(`
    CREATE TABLE IF NOT EXISTS app_user_profiles (
      client_id TEXT PRIMARY KEY,
      uid TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS recharge_records (
      id TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      date TEXT NOT NULL,
      price DOUBLE PRECISION NOT NULL,
      tier TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_recharge_uid ON recharge_records(uid);
    CREATE INDEX IF NOT EXISTS idx_recharge_created ON recharge_records(created_at DESC);

    CREATE TABLE IF NOT EXISTS watch_history_entries (
      client_id TEXT NOT NULL,
      series_id TEXT NOT NULL,
      episode_index INTEGER NOT NULL,
      seconds INTEGER NOT NULL,
      last_watched_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (client_id, series_id, episode_index)
    );
    CREATE INDEX IF NOT EXISTS idx_watch_client ON watch_history_entries(client_id);

    CREATE TABLE IF NOT EXISTS user_favorites (
      client_id TEXT NOT NULL,
      series_id TEXT NOT NULL,
      PRIMARY KEY (client_id, series_id)
    );
    CREATE INDEX IF NOT EXISTS idx_fav_series ON user_favorites(series_id);

    CREATE TABLE IF NOT EXISTS user_likes (
      client_id TEXT NOT NULL,
      series_id TEXT NOT NULL,
      PRIMARY KEY (client_id, series_id)
    );
    CREATE INDEX IF NOT EXISTS idx_likes_series ON user_likes(series_id);
  `);
  initialized = true;
}

function rowToUser(row: {
  client_id: string;
  uid: string;
  created_at: Date;
}): StoredUser {
  return {
    clientId: row.client_id,
    uid: row.uid,
    createdAt: row.created_at.toISOString()
  };
}

export async function getOrCreateUid(clientId: string): Promise<StoredUser> {
  await initIfNeeded();
  const conn = getPool();
  const uid = randomUid();
  await conn.query(
    `INSERT INTO app_user_profiles (client_id, uid) VALUES ($1, $2)
     ON CONFLICT (client_id) DO NOTHING`,
    [clientId, uid]
  );
  const r = await conn.query(
    `SELECT client_id, uid, created_at FROM app_user_profiles WHERE client_id = $1`,
    [clientId]
  );
  if (!r.rows[0]) throw new Error("getOrCreateUid: insert failed");
  return rowToUser(r.rows[0]);
}

export async function getUidByClientId(clientId: string): Promise<string | null> {
  await initIfNeeded();
  const r = await getPool().query(`SELECT uid FROM app_user_profiles WHERE client_id = $1`, [
    clientId
  ]);
  return r.rows[0]?.uid ?? null;
}

export async function getAllUsers(): Promise<StoredUser[]> {
  await initIfNeeded();
  const r = await getPool().query(
    `SELECT client_id, uid, created_at FROM app_user_profiles ORDER BY created_at DESC`
  );
  return r.rows.map(rowToUser);
}

export async function addRechargeRecord(
  record: Omit<RechargeRecord, "id" | "createdAt">
): Promise<RechargeRecord> {
  await initIfNeeded();
  const id = `rec-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const full: RechargeRecord = {
    ...record,
    id,
    createdAt: new Date().toISOString()
  };
  await getPool().query(
    `INSERT INTO recharge_records (id, uid, date, price, tier, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [full.id, full.uid, full.date, full.price, full.tier]
  );
  return full;
}

export async function getRechargeByUid(uid: string): Promise<RechargeRecord[]> {
  await initIfNeeded();
  const r = await getPool().query(
    `SELECT id, uid, date, price, tier, created_at FROM recharge_records
     WHERE uid = $1 ORDER BY date DESC, created_at DESC`,
    [uid]
  );
  return r.rows.map((row: RechargeRow) => mapRechargeRow(row));
}

export async function getAllRechargeRecords(): Promise<RechargeRecord[]> {
  await initIfNeeded();
  const r = await getPool().query(
    `SELECT id, uid, date, price, tier, created_at FROM recharge_records ORDER BY created_at DESC`
  );
  return r.rows.map((row: RechargeRow) => mapRechargeRow(row));
}

export async function getWatchHistory(clientId: string): Promise<WatchHistoryEntry[]> {
  await initIfNeeded();
  const r = await getPool().query(
    `SELECT series_id, episode_index, seconds, last_watched_at
     FROM watch_history_entries WHERE client_id = $1
     ORDER BY last_watched_at DESC`,
    [clientId]
  );
  return r.rows.map((row: WatchHistoryRow) => ({
    seriesId: row.series_id,
    episodeIndex: row.episode_index,
    seconds: row.seconds,
    lastWatchedAt: row.last_watched_at.toISOString()
  }));
}

export async function syncWatchHistory(
  clientId: string,
  entries: WatchHistoryEntry[]
): Promise<void> {
  await initIfNeeded();
  const db = getPool();
  await db.query(`DELETE FROM watch_history_entries WHERE client_id = $1`, [clientId]);
  for (const e of entries) {
    await db.query(
      `INSERT INTO watch_history_entries
        (client_id, series_id, episode_index, seconds, last_watched_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        clientId,
        e.seriesId,
        e.episodeIndex,
        e.seconds,
        new Date(e.lastWatchedAt)
      ]
    );
  }
}

export async function getAllWatchHistory(): Promise<Record<string, WatchHistoryEntry[]>> {
  await initIfNeeded();
  const r = await getPool().query(
    `SELECT client_id, series_id, episode_index, seconds, last_watched_at
     FROM watch_history_entries ORDER BY client_id, last_watched_at DESC`
  );
  const out: Record<string, WatchHistoryEntry[]> = {};
  for (const row of r.rows as WatchHistoryFullRow[]) {
    const cid = row.client_id;
    if (!out[cid]) out[cid] = [];
    out[cid].push({
      seriesId: row.series_id,
      episodeIndex: row.episode_index,
      seconds: row.seconds,
      lastWatchedAt: row.last_watched_at.toISOString()
    });
  }
  return out;
}

export async function getUserFavorites(clientId: string): Promise<string[]> {
  await initIfNeeded();
  const r = await getPool().query(
    `SELECT series_id FROM user_favorites WHERE client_id = $1 ORDER BY series_id`,
    [clientId]
  );
  return r.rows.map((x: { series_id: string }) => x.series_id);
}

export async function syncUserFavorites(clientId: string, seriesIds: string[]): Promise<void> {
  await initIfNeeded();
  const db = getPool();
  await db.query(`DELETE FROM user_favorites WHERE client_id = $1`, [clientId]);
  for (const sid of seriesIds) {
    await db.query(
      `INSERT INTO user_favorites (client_id, series_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [clientId, sid]
    );
  }
}

export async function getAllUserFavorites(): Promise<Record<string, string[]>> {
  await initIfNeeded();
  const r = await getPool().query(
    `SELECT client_id, series_id FROM user_favorites ORDER BY client_id, series_id`
  );
  const out: Record<string, string[]> = {};
  for (const row of r.rows as FavoritePairRow[]) {
    const cid = row.client_id;
    if (!out[cid]) out[cid] = [];
    out[cid].push(row.series_id);
  }
  return out;
}

export async function getCollectionCount(seriesId: string): Promise<number> {
  await initIfNeeded();
  const r = await getPool().query(
    `SELECT COUNT(*)::int AS c FROM user_favorites WHERE series_id = $1`,
    [seriesId]
  );
  return r.rows[0]?.c ?? 0;
}

export async function getLikesCount(seriesId: string): Promise<number> {
  await initIfNeeded();
  const r = await getPool().query(
    `SELECT COUNT(*)::int AS c FROM user_likes WHERE series_id = $1`,
    [seriesId]
  );
  return r.rows[0]?.c ?? 0;
}

export async function getUserLikes(clientId: string): Promise<string[]> {
  await initIfNeeded();
  const r = await getPool().query(
    `SELECT series_id FROM user_likes WHERE client_id = $1 ORDER BY series_id`,
    [clientId]
  );
  return r.rows.map((x: { series_id: string }) => x.series_id);
}

export async function toggleUserLike(clientId: string, seriesId: string): Promise<boolean> {
  await initIfNeeded();
  const conn = getPool();
  const existing = await conn.query(
    `SELECT 1 FROM user_likes WHERE client_id = $1 AND series_id = $2`,
    [clientId, seriesId]
  );
  if (existing.rows.length > 0) {
    await conn.query(`DELETE FROM user_likes WHERE client_id = $1 AND series_id = $2`, [
      clientId,
      seriesId
    ]);
    return false;
  }
  await conn.query(
    `INSERT INTO user_likes (client_id, series_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [clientId, seriesId]
  );
  return true;
}

export async function getAllUserLikes(): Promise<Record<string, string[]>> {
  await initIfNeeded();
  const r = await getPool().query(
    `SELECT client_id, series_id FROM user_likes ORDER BY client_id, series_id`
  );
  const out: Record<string, string[]> = {};
  for (const row of r.rows as FavoritePairRow[]) {
    const cid = row.client_id;
    if (!out[cid]) out[cid] = [];
    out[cid].push(row.series_id);
  }
  return out;
}
