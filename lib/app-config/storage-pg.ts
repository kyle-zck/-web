import { Pool } from "pg";
import { getDatabaseUrl } from "@/lib/db/url";

let pool: Pool | null = null;
let initialized = false;
let initPromise: Promise<void> | null = null;

function envMs(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function getPgTimeouts() {
  const connectionTimeoutMillis = envMs("PG_CONNECTION_TIMEOUT_MS", 60000);
  const statement_timeout = envMs("PG_STATEMENT_TIMEOUT_MS", 60000);
  const query_timeout = envMs("PG_QUERY_TIMEOUT_MS", 60000);
  return { connectionTimeoutMillis, statement_timeout, query_timeout };
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function getPool(): Pool {
  if (pool) return pool;
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "Missing DATABASE_URL / SUPABASE_DB_URL / PG_URL for site_config_snapshot (pg)"
    );
  }
  const timeouts = getPgTimeouts();
  // Serverless 环境（Vercel）会高并发创建实例，默认 Pool=10 很容易打爆 Supabase 连接上限。
  // 这里把默认连接数压到 2，并允许用环境变量覆盖。
  const max = envInt("PG_POOL_MAX", 2);
  pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: timeouts.connectionTimeoutMillis,
    statement_timeout: timeouts.statement_timeout,
    query_timeout: timeouts.query_timeout,
    keepAlive: true,
    max,
    ssl:
      url.includes("localhost") || url.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false }
  });
  return pool;
}

async function runInitDdl(): Promise<void> {
  // 这里不要使用 advisory lock：在 Vercel serverless 并发冷启动时容易排队导致首屏变慢/超时。
  // `CREATE TABLE IF NOT EXISTS` 本身是幂等的，足以覆盖初始化需求。
  const conn = getPool();
  await conn.query(`
    CREATE TABLE IF NOT EXISTS site_config_snapshot (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at BIGINT NOT NULL
    );
  `);
}

export async function initAppSiteConfigTableIfNeeded(): Promise<void> {
  if (initialized) return;
  if (!initPromise) {
    initPromise = runInitDdl().then(() => {
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
