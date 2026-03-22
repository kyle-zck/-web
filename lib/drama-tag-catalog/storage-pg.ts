import { Pool } from "pg";
import { getDatabaseUrl } from "@/lib/db/url";

export type CatalogItem = { id: string; name: string };

let pool: Pool | null = null;
let initialized = false;

function getPool(): Pool {
  if (pool) return pool;
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error(
      "Missing DATABASE_URL / SUPABASE_DB_URL / PG_URL for drama_tag_catalog"
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

async function initIfNeeded(): Promise<void> {
  if (initialized) return;
  const conn = getPool();
  await conn.query(`
    CREATE TABLE IF NOT EXISTS drama_tag_catalog (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at BIGINT NOT NULL
    );
  `);
  initialized = true;
}

/** 无行时返回 `undefined`（便于从本地 JSON 迁移）；有行时返回数组（可为空） */
export async function readItemsFromPg(): Promise<CatalogItem[] | undefined> {
  await initIfNeeded();
  const { rows } = await getPool().query(
    `SELECT items_json FROM drama_tag_catalog WHERE id = 1`
  );
  const row = rows[0] as { items_json: unknown } | undefined;
  if (!row) return undefined;
  const raw = row.items_json;
  if (raw == null) return [];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is CatalogItem =>
      x != null &&
      typeof x === "object" &&
      typeof (x as CatalogItem).id === "string" &&
      typeof (x as CatalogItem).name === "string"
  );
}

export async function writeItemsToPg(items: CatalogItem[]): Promise<void> {
  await initIfNeeded();
  const now = Date.now();
  await getPool().query(
    `
    INSERT INTO drama_tag_catalog (id, items_json, updated_at)
    VALUES (1, $1::jsonb, $2)
    ON CONFLICT (id) DO UPDATE SET
      items_json = EXCLUDED.items_json,
      updated_at = EXCLUDED.updated_at
    `,
    [JSON.stringify(items), now]
  );
}
