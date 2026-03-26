import { Pool } from "pg";
import { getDatabaseUrl } from "@/lib/db/url";

/** 与「剧目 / 用户」等并行建表时避免竞态 */
const ADVISORY_LOCK_KEY = 8812342001;

let pool: Pool | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "Missing DATABASE_URL / SUPABASE_DB_URL / PG_URL for site_config_snapshot (pg)"
    );
  }
  pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 15000,
    statement_timeout: 15000,
    query_timeout: 15000,
    ssl:
      url.includes("localhost") || url.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false }
  });
  return pool;
}

function sslForUrl(url: string) {
  return url.includes("localhost") || url.includes("127.0.0.1")
    ? undefined
    : { rejectUnauthorized: false };
}

type PgClient = {
  connect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<unknown>;
  end(): Promise<void>;
};

async function runInitDdlWithAdvisoryLock(): Promise<void> {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "Missing DATABASE_URL / SUPABASE_DB_URL / PG_URL for site_config_snapshot (pg)"
    );
  }
  const pg = await import("pg");
  const Client = (pg as unknown as { Client: new (config: object) => PgClient }).Client;
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 15000,
    statement_timeout: 15000,
    query_timeout: 15000,
    ssl: sslForUrl(url)
  });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS site_config_snapshot (
        id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at BIGINT NOT NULL
      );
    `);
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]);
    } catch {
      /* ignore */
    }
    await client.end();
  }
}

export async function initAppSiteConfigTableIfNeeded(): Promise<void> {
  if (initialized) return;
  if (!initPromise) {
    initPromise = runInitDdlWithAdvisoryLock().then(() => {
      initialized = true;
    });
  }
  await initPromise;
}

export async function readAppSiteConfigJson(): Promise<Record<string, unknown> | null> {
  await initAppSiteConfigTableIfNeeded();
  const conn = getPool();
  const { rows } = await conn.query(
    `SELECT config_json FROM site_config_snapshot WHERE id = 1`
  );
  const row = rows[0] as { config_json: unknown } | undefined;
  const raw = row?.config_json;
  if (raw == null) return null;
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export async function upsertAppSiteConfigJson(
  config: Record<string, unknown>
): Promise<void> {
  await initAppSiteConfigTableIfNeeded();
  const conn = getPool();
  const now = Date.now();
  await conn.query(
    `
    INSERT INTO site_config_snapshot (id, config_json, updated_at)
    VALUES (1, $1::jsonb, $2)
    ON CONFLICT (id) DO UPDATE SET
      config_json = EXCLUDED.config_json,
      updated_at = EXCLUDED.updated_at
    `,
    [JSON.stringify(config), now]
  );
}
