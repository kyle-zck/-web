import type { Pool } from "pg";
import { getAdminPgPool } from "@/lib/admin/admin-pg";

const TABLE = "admin_asset_config_snapshot";

async function ensureTable(conn: Pool) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at BIGINT NOT NULL
    );
  `);
}

export async function readAdminAssetConfigJson(): Promise<Record<string, unknown> | null> {
  const conn = getAdminPgPool();
  if (!conn) return null;
  await ensureTable(conn);
  const { rows } = await conn.query(`SELECT config_json FROM ${TABLE} WHERE id = 1`);
  const row = rows[0] as { config_json?: unknown } | undefined;
  const raw = row?.config_json;
  if (raw == null) return null;
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export async function upsertAdminAssetConfigJson(config: Record<string, unknown>): Promise<void> {
  const conn = getAdminPgPool();
  if (!conn) throw new Error("admin pg not configured");
  await ensureTable(conn);
  const now = Date.now();
  await conn.query(
    `
    INSERT INTO ${TABLE} (id, config_json, updated_at)
    VALUES (1, $1::jsonb, $2)
    ON CONFLICT (id) DO UPDATE SET
      config_json = EXCLUDED.config_json,
      updated_at = EXCLUDED.updated_at
    `,
    [JSON.stringify(config), now]
  );
}

