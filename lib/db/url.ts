/**
 * 统一解析 Postgres 连接串（Supabase / 其它托管库均可）。
 * 优先级：DATABASE_URL → SUPABASE_DB_URL → PG_URL
 */
export function getDatabaseUrl(): string | undefined {
  const u =
    process.env.DATABASE_URL?.trim() ||
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.PG_URL?.trim();
  return u || undefined;
}
