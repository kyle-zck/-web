import { Pool } from "pg";
import { getDatabaseUrl } from "@/lib/db/url";

let pool: Pool | null = null;

/** 用于后台账号密码存储（与剧目存储共用 DATABASE_URL / SUPABASE_DB_URL） */
export function getAdminPgPool(): Pool | null {
  const url = getDatabaseUrl();
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
