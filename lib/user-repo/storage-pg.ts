import { Pool } from "pg";
import { getDatabaseUrl } from "@/lib/db/url";
import { createHash, createCipheriv, randomBytes } from "crypto";
import type {
  AccountStatus,
  AdminUserQuery,
  AdminUserSafe,
  DeviceType,
  EngagementCounts,
  LoginProvider,
  RechargeRecord,
  StoredUser,
  WatchHistoryEntry
} from "./types";

type RechargeRow = {
  id: string;
  uid: string;
  date: string;
  price: string | number;
  tier: string;
  recharge_days: number | null;
  created_at: Date;
};

function mapRechargeRow(row: RechargeRow): RechargeRecord {
  return {
    id: row.id,
    uid: row.uid,
    date: row.date,
    price: Number(row.price),
    tier: row.tier,
    rechargeDays: Number.isFinite(Number(row.recharge_days)) ? Number(row.recharge_days) : 0,
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

function nowIso(): string {
  return new Date().toISOString();
}

function emptyStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function detectDeviceType(userAgent: string | null | undefined): DeviceType {
  const ua = (userAgent ?? "").toLowerCase();
  if (!ua) return "unknown";
  if (ua.includes("android")) return "android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ios")) return "ios";
  return "web";
}

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
        : { rejectUnauthorized: false },
    max: 10,
  });
  return pool;
}

function randomUid(): string {
  return String(Math.floor(100000000 + Math.random() * 900000000));
}

const TOKEN_KEY_ENV = "USER_TOKEN_ENC_KEY";

function tokenKeyBytes(): Buffer {
  const raw = (process.env[TOKEN_KEY_ENV] ?? "").trim();
  if (!raw) throw new Error(`Missing ${TOKEN_KEY_ENV} (32+ chars recommended)`);
  // 派生 32 bytes key（避免用户给的长度不对）
  return createHash("sha256").update(raw, "utf8").digest();
}

function encryptToken(plain: string): string {
  const key = tokenKeyBytes();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
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

    CREATE TABLE IF NOT EXISTS app_users (
      uid TEXT PRIMARY KEY,
      user_type TEXT NOT NULL DEFAULT 'guest',
      client_id TEXT UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      provider TEXT NOT NULL DEFAULT '',
      provider_sub TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_ip TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      membership_plan TEXT NOT NULL DEFAULT '',
      membership_expires_at TIMESTAMPTZ,
      device_type TEXT NOT NULL DEFAULT 'unknown',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_app_users_uid ON app_users(uid);
    CREATE INDEX IF NOT EXISTS idx_app_users_email ON app_users(email);
    CREATE INDEX IF NOT EXISTS idx_app_users_provider ON app_users(provider);
    CREATE INDEX IF NOT EXISTS idx_app_users_plan ON app_users(membership_plan);
    CREATE INDEX IF NOT EXISTS idx_app_users_last_login ON app_users(last_login_at DESC);

    CREATE TABLE IF NOT EXISTS app_user_tokens (
      uid TEXT PRIMARY KEY,
      access_token_enc TEXT NOT NULL DEFAULT '',
      refresh_token_enc TEXT NOT NULL DEFAULT '',
      token_expires_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS app_user_oauth_identities (
      provider TEXT NOT NULL,
      provider_sub TEXT NOT NULL,
      uid TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (provider, provider_sub),
      UNIQUE (uid)
    );
    CREATE INDEX IF NOT EXISTS idx_oauth_uid ON app_user_oauth_identities(uid);

    CREATE TABLE IF NOT EXISTS recharge_records (
      id TEXT PRIMARY KEY,
      uid TEXT NOT NULL,
      date TEXT NOT NULL,
      price DOUBLE PRECISION NOT NULL,
      tier TEXT NOT NULL,
      recharge_days INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE recharge_records
      ADD COLUMN IF NOT EXISTS recharge_days INTEGER NOT NULL DEFAULT 0;
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

    CREATE TABLE IF NOT EXISTS user_series_views (
      client_id TEXT NOT NULL,
      series_id TEXT NOT NULL,
      viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (client_id, series_id)
    );
    CREATE INDEX IF NOT EXISTS idx_views_series ON user_series_views(series_id);

    -- Stripe / payment webhook idempotency
    CREATE TABLE IF NOT EXISTS payment_events (
      provider TEXT NOT NULL,
      event_id TEXT NOT NULL,
      session_id TEXT NOT NULL DEFAULT '',
      uid TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (provider, event_id)
    );
    CREATE INDEX IF NOT EXISTS idx_payment_events_uid ON payment_events(uid);

    -- RLS: idempotent (safe to re-run on each cold start)
    -- FORCE ROW LEVEL SECURITY so even table owner obeys RLS (critical for webhook/service-role path)
    ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE payment_events FORCE ROW LEVEL SECURITY;
    -- INSERT: auth.uid must match the uid column (prevents inserting arbitrary events via API)
    DROP POLICY IF EXISTS payment_events_insert_authenticated ON payment_events;
    CREATE POLICY payment_events_insert_authenticated
      ON payment_events FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid()::text = uid);
    -- SELECT: auth.uid must match the uid column (users only see their own payment events)
    DROP POLICY IF EXISTS payment_events_select_authenticated ON payment_events;
    CREATE POLICY payment_events_select_authenticated
      ON payment_events FOR SELECT
      TO authenticated
      USING (auth.uid()::text = uid);
  `);
  initialized = true;
}

export async function recordPaymentEventOnce(params: {
  provider: string;
  eventId: string;
  sessionId?: string | null;
  uid?: string | null;
}): Promise<boolean> {
  await initIfNeeded();
  const provider = (params.provider ?? "").trim();
  const eventId = (params.eventId ?? "").trim();
  if (!provider || !eventId) return false;
  const sessionId = (params.sessionId ?? "").trim();
  const uid = (params.uid ?? "").trim();
  const r = await getPool().query(
    `
    INSERT INTO payment_events (provider, event_id, session_id, uid)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (provider, event_id) DO NOTHING
    RETURNING provider
    `,
    [provider, eventId, sessionId, uid]
  );
  return Boolean(r.rowCount && r.rowCount > 0);
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
  const profile = rowToUser(r.rows[0]);
  // 同步到 app_users（Guest）
  await conn.query(
    `
    INSERT INTO app_users (uid, user_type, client_id, created_at, last_login_at, status, updated_at)
    VALUES ($1, 'guest', $2, $3, NOW(), 'active', NOW())
    ON CONFLICT (uid) DO UPDATE SET
      client_id = COALESCE(EXCLUDED.client_id, app_users.client_id),
      last_login_at = NOW(),
      updated_at = NOW()
    `,
    [profile.uid, profile.clientId, new Date(profile.createdAt)]
  );
  return profile;
}

export async function touchGuestLogin(params: {
  clientId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await initIfNeeded();
  const { clientId, ip, userAgent } = params;
  const deviceType = detectDeviceType(userAgent);
  await getPool().query(
    `
    UPDATE app_users SET
      last_login_at = NOW(),
      last_login_ip = $2,
      device_type = $3,
      updated_at = NOW()
    WHERE uid = (SELECT uid FROM app_user_profiles WHERE client_id = $1)
    `,
    [clientId, emptyStr(ip), deviceType]
  );
}

export async function upsertSignedInUser(params: {
  uid: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  provider: LoginProvider;
  providerSub: string;
  ip?: string | null;
  userAgent?: string | null;
  createdAt?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: number | null;
}): Promise<void> {
  await initIfNeeded();
  const deviceType = detectDeviceType(params.userAgent);
  const createdAt = params.createdAt ? new Date(params.createdAt) : new Date();
  await getPool().query(
    `
    INSERT INTO app_users
      (uid, user_type, name, email, phone, provider, provider_sub, created_at,
       last_login_at, last_login_ip, status, device_type, updated_at)
    VALUES
      ($1, 'sign-in', $2, $3, $4, $5, $6, $7, NOW(), $8, 'active', $9, NOW())
    ON CONFLICT (uid) DO UPDATE SET
      user_type = 'sign-in',
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      phone = EXCLUDED.phone,
      provider = EXCLUDED.provider,
      provider_sub = EXCLUDED.provider_sub,
      last_login_at = NOW(),
      last_login_ip = EXCLUDED.last_login_ip,
      device_type = EXCLUDED.device_type,
      updated_at = NOW()
    `,
    [
      params.uid,
      emptyStr(params.name),
      emptyStr(params.email),
      emptyStr(params.phone),
      params.provider ?? "",
      params.providerSub,
      createdAt,
      emptyStr(params.ip),
      deviceType
    ]
  );

  // token 仅存库，不返回给后台；没有加密 key 时直接跳过（避免写明文）
  if (params.accessToken || params.refreshToken || params.tokenExpiresAt) {
    try {
      const accessEnc = params.accessToken ? encryptToken(params.accessToken) : "";
      const refreshEnc = params.refreshToken ? encryptToken(params.refreshToken) : "";
      const expiresAt = params.tokenExpiresAt ? new Date(params.tokenExpiresAt * 1000) : null;
      await getPool().query(
        `
        INSERT INTO app_user_tokens (uid, access_token_enc, refresh_token_enc, token_expires_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (uid) DO UPDATE SET
          access_token_enc = EXCLUDED.access_token_enc,
          refresh_token_enc = EXCLUDED.refresh_token_enc,
          token_expires_at = EXCLUDED.token_expires_at,
          updated_at = NOW()
        `,
        [params.uid, accessEnc, refreshEnc, expiresAt]
      );
    } catch (e) {
      console.error("[app_users] store tokens skipped:", e);
    }
  }
}

export async function getOrCreateUidForProvider(params: {
  provider: LoginProvider;
  providerSub: string;
}): Promise<string> {
  await initIfNeeded();
  const provider = params.provider ?? "";
  const providerSub = params.providerSub;
  if (!provider || !providerSub) {
    throw new Error("getOrCreateUidForProvider: provider/providerSub required");
  }
  const conn = getPool();
  const existing = await conn.query(
    `SELECT uid FROM app_user_oauth_identities WHERE provider = $1 AND provider_sub = $2`,
    [provider, providerSub]
  );
  const found = existing.rows[0]?.uid as string | undefined;
  if (found) return found;

  const uid = randomUid();
  await conn.query(
    `
    INSERT INTO app_user_oauth_identities (provider, provider_sub, uid)
    VALUES ($1, $2, $3)
    ON CONFLICT (provider, provider_sub) DO NOTHING
    `,
    [provider, providerSub, uid]
  );
  const r = await conn.query(
    `SELECT uid FROM app_user_oauth_identities WHERE provider = $1 AND provider_sub = $2`,
    [provider, providerSub]
  );
  const finalUid = r.rows[0]?.uid as string | undefined;
  if (!finalUid) throw new Error("getOrCreateUidForProvider: insert failed");
  return finalUid;
}

function rowToAdminSafe(row: {
  uid: string;
  name: string;
  email: string;
  phone: string;
  provider: string;
  created_at: Date;
  last_login_at: Date;
  last_login_ip: string;
  status: string;
  membership_plan: string;
  membership_expires_at: Date | null;
  device_type: string;
}): AdminUserSafe {
  return {
    uid: row.uid,
    name: row.name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    provider: (row.provider ?? "") as LoginProvider,
    createdAt: row.created_at?.toISOString?.() ?? nowIso(),
    lastLoginAt: row.last_login_at?.toISOString?.() ?? nowIso(),
    lastLoginIp: row.last_login_ip ?? "",
    status: (row.status ?? "active") as AccountStatus,
    membershipPlan: row.membership_plan ?? "",
    membershipExpiresAt: row.membership_expires_at ? row.membership_expires_at.toISOString() : "",
    deviceType: (row.device_type ?? "unknown") as DeviceType
  };
}

export async function grantMembershipByUid(params: {
  uid: string;
  planLabel: string;
  /** 以“剩余天数”为准直接覆盖到 now + days */
  remainingDays: number;
}): Promise<void> {
  await initIfNeeded();
  const uid = params.uid.trim();
  if (!uid) throw new Error("grantMembershipByUid: uid required");
  const days = Number.isFinite(params.remainingDays)
    ? Math.max(0, Math.floor(params.remainingDays))
    : 0;
  const plan = params.planLabel?.trim?.() ? params.planLabel.trim() : "";
  const expiresAt = days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null;
  // 兜底：如果 app_users 里还没有这个 UID（仅有充值记录场景），先补一个最小用户壳
  await getPool().query(
    `
    INSERT INTO app_users (uid, user_type, created_at, last_login_at, status, updated_at)
    VALUES ($1, 'guest', NOW(), NOW(), 'active', NOW())
    ON CONFLICT (uid) DO NOTHING
    `,
    [uid]
  );
  await getPool().query(
    `
    UPDATE app_users SET
      membership_plan = $2,
      membership_expires_at = $3,
      updated_at = NOW()
    WHERE uid = $1
    `,
    [uid, plan, expiresAt]
  );
}

export async function adminQueryUsers(query: AdminUserQuery): Promise<AdminUserSafe[]> {
  await initIfNeeded();
  const where: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  const uid = (query.uid ?? "").trim();
  if (uid) {
    where.push(`uid = $${i++}`);
    params.push(uid);
  }
  const name = (query.name ?? "").trim();
  if (name) {
    where.push(`name ILIKE $${i++}`);
    params.push(`%${name}%`);
  }
  const email = (query.email ?? "").trim();
  if (email) {
    where.push(`email ILIKE $${i++}`);
    params.push(`%${email}%`);
  }
  const provider = query.provider ?? "";
  if (provider) {
    where.push(`provider = $${i++}`);
    params.push(provider);
  }
  const membershipPlan = (query.membershipPlan ?? "").trim();
  if (membershipPlan) {
    where.push(`membership_plan = $${i++}`);
    params.push(membershipPlan);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sort =
    query.remainingSort === "remainingAsc"
      ? `ORDER BY (COALESCE(membership_expires_at, NOW()) - NOW()) ASC, created_at DESC`
      : query.remainingSort === "remainingDesc"
        ? `ORDER BY (COALESCE(membership_expires_at, NOW()) - NOW()) DESC, created_at DESC`
        : `ORDER BY created_at DESC`;

  const r = await getPool().query(
    `
    SELECT
      uid, name, email, phone, provider,
      created_at, last_login_at, last_login_ip,
      status, membership_plan, membership_expires_at, device_type
    FROM app_users
    ${whereSql}
    ${sort}
    LIMIT 500
    `,
    params
  );
  return (r.rows as Array<Parameters<typeof rowToAdminSafe>[0]>).map((row) =>
    rowToAdminSafe(row)
  );
}

export async function deleteUsersByUids(uids: string[]): Promise<number> {
  await initIfNeeded();
  const unique = [...new Set(uids.map((x) => x.trim()).filter(Boolean))];
  if (unique.length === 0) return 0;
  const res = await getPool().query(`DELETE FROM app_users WHERE uid = ANY($1::text[])`, [unique]);
  return res.rowCount ?? 0;
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
    `INSERT INTO recharge_records (id, uid, date, price, tier, recharge_days, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [full.id, full.uid, full.date, full.price, full.tier, full.rechargeDays]
  );
  return full;
}

export async function getRechargeByUid(uid: string): Promise<RechargeRecord[]> {
  await initIfNeeded();
  const r = await getPool().query(
    `SELECT id, uid, date, price, tier, recharge_days, created_at FROM recharge_records
     WHERE uid = $1 ORDER BY date DESC, created_at DESC`,
    [uid]
  );
  return r.rows.map((row: RechargeRow) => mapRechargeRow(row));
}

export async function getAllRechargeRecords(): Promise<RechargeRecord[]> {
  await initIfNeeded();
  const r = await getPool().query(
    `SELECT id, uid, date, price, tier, recharge_days, created_at FROM recharge_records ORDER BY created_at DESC`
  );
  return r.rows.map((row: RechargeRow) => mapRechargeRow(row));
}

export async function deleteRechargeRecordById(id: string): Promise<RechargeRecord | null> {
  await initIfNeeded();
  const r = await getPool().query(
    `DELETE FROM recharge_records
     WHERE id = $1
     RETURNING id, uid, date, price, tier, recharge_days, created_at`,
    [id]
  );
  const row = r.rows[0] as RechargeRow | undefined;
  return row ? mapRechargeRow(row) : null;
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
  const dedup = new Map<string, WatchHistoryEntry>();
  for (const e of entries) {
    const key = `${e.seriesId}::${e.episodeIndex}`;
    dedup.set(key, e);
  }
  if (dedup.size === 0) return;
  const vals = [...dedup.values()]
    .map((e, i) => `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`)
    .join(", ");
  const flat = [clientId];
  for (const e of dedup.values()) {
    flat.push(e.seriesId, String(e.episodeIndex), String(e.seconds), new Date(e.lastWatchedAt).toISOString());
  }
  await db.query(
    `INSERT INTO watch_history_entries
       (client_id, series_id, episode_index, seconds, last_watched_at)
     VALUES ${vals}
     ON CONFLICT (client_id, series_id, episode_index) DO UPDATE SET
       seconds = EXCLUDED.seconds,
       last_watched_at = EXCLUDED.last_watched_at`,
    flat
  );
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
  if (seriesIds.length === 0) return;
  const vals = seriesIds.map((_, i) => `($1, $${i + 2})`).join(", ");
  await db.query(
    `INSERT INTO user_favorites (client_id, series_id) VALUES ${vals} ON CONFLICT DO NOTHING`,
    [clientId, ...seriesIds]
  );
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

type CountRow = { series_id: string; c: number };

/** 一次请求内用 3 条 GROUP BY 查询批量取数，避免 N×3 次往返 */
export async function getEngagementCountsBatch(
  seriesIds: string[]
): Promise<Record<string, EngagementCounts>> {
  await initIfNeeded();
  const unique = [...new Set(seriesIds.filter((id) => id && id.length > 0))];
  if (unique.length === 0) return {};

  const pool = getPool();
  const [favR, likeR, viewR] = await Promise.all([
    pool.query(
      `SELECT series_id, COUNT(*)::int AS c FROM user_favorites WHERE series_id = ANY($1::text[]) GROUP BY series_id`,
      [unique]
    ),
    pool.query(
      `SELECT series_id, COUNT(*)::int AS c FROM user_likes WHERE series_id = ANY($1::text[]) GROUP BY series_id`,
      [unique]
    ),
    pool.query(
      `SELECT series_id, COUNT(*)::int AS c FROM user_series_views WHERE series_id = ANY($1::text[]) GROUP BY series_id`,
      [unique]
    )
  ]);

  const out: Record<string, EngagementCounts> = {};
  for (const id of unique) {
    out[id] = { collectionCount: 0, likesCount: 0, viewsCount: 0 };
  }
  for (const row of favR.rows as CountRow[]) {
    if (out[row.series_id]) out[row.series_id].collectionCount = row.c;
  }
  for (const row of likeR.rows as CountRow[]) {
    if (out[row.series_id]) out[row.series_id].likesCount = row.c;
  }
  for (const row of viewR.rows as CountRow[]) {
    if (out[row.series_id]) out[row.series_id].viewsCount = row.c;
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

export async function getViewsCount(seriesId: string): Promise<number> {
  await initIfNeeded();
  const r = await getPool().query(
    `SELECT COUNT(*)::int AS c FROM user_series_views WHERE series_id = $1`,
    [seriesId]
  );
  return r.rows[0]?.c ?? 0;
}

/** 记录一次观看（每用户每剧仅一条）；返回是否为新记录 */
export async function recordSeriesView(clientId: string, seriesId: string): Promise<boolean> {
  await initIfNeeded();
  const r = await getPool().query(
    `INSERT INTO user_series_views (client_id, series_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING RETURNING 1`,
    [clientId, seriesId]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function getAllUserViews(): Promise<Record<string, string[]>> {
  await initIfNeeded();
  const r = await getPool().query(
    `SELECT client_id, series_id FROM user_series_views ORDER BY client_id, series_id`
  );
  const out: Record<string, string[]> = {};
  for (const row of r.rows as FavoritePairRow[]) {
    const cid = row.client_id;
    if (!out[cid]) out[cid] = [];
    out[cid].push(row.series_id);
  }
  return out;
}
