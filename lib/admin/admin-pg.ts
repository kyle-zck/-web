import { Pool } from "pg";

let pool: Pool | null = null;

/** 用于后台账号密码存储（与剧目存储共用 DATABASE_URL） */
export function getAdminPgPool(): Pool | null {
  const url = process.env.PG_URL ?? process.env.DATABASE_URL;
  if (!url) return null;
  if (pool) return pool;
  pool = new Pool({
    connectionString: url,
    ssl:
      url.includes("localhost") || url.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false }
  });
  return pool;
}
