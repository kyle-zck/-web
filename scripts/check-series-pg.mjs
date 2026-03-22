#!/usr/bin/env node
/**
 * 检查 SERIES_STORAGE=pg 时 `series` / `episodes` 表是否已包含剧目扩展字段。
 * 用法（Node 20+）：
 *   node --env-file=.env.local scripts/check-series-pg.mjs
 */
import pg from "pg";

const url = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.PG_URL;
if (!url) {
  console.error("❌ 未找到 DATABASE_URL / SUPABASE_DB_URL / PG_URL");
  process.exit(1);
}

const requiredSeries = [
  "drama_id",
  "original_name",
  "local_or_translated",
  "lock_start_index",
  "listed",
  "completed_at",
  "listed_at",
  "task_status"
];
const requiredEpisodes = ["source_file_name", "local_video_url"];

async function main() {
  const pool = new pg.Pool({
    connectionString: url,
    ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : { rejectUnauthorized: false }
  });
  try {
    const { rows: seriesCols } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'series'`
    );
    const { rows: epCols } = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'episodes'`
    );
    const sSet = new Set(seriesCols.map((r) => r.column_name));
    const eSet = new Set(epCols.map((r) => r.column_name));

    console.log("当前模式：SERIES_STORAGE=pg（由 .env 决定，本脚本只检查表结构）\n");

    let ok = true;
    for (const c of requiredSeries) {
      if (sSet.has(c)) console.log(`  ✓ series.${c}`);
      else {
        console.log(`  ✗ 缺少 series.${c}`);
        ok = false;
      }
    }
    for (const c of requiredEpisodes) {
      if (eSet.has(c)) console.log(`  ✓ episodes.${c}`);
      else {
        console.log(`  ✗ 缺少 episodes.${c}`);
        ok = false;
      }
    }

    const { rows: sample } = await pool.query(
      `SELECT id, title, drama_id, original_name, created_at FROM series ORDER BY created_at DESC NULLS LAST LIMIT 3`
    );
    console.log("\n最近 3 条剧目（id / title / drama_id / original_name / created_at）：");
    console.table(sample);

    if (!ok) {
      console.log(
        "\n→ 请启动一次本项目的 Next 服务（npm run dev），让 lib/series-repo/storage-pg.ts 的 initIfNeeded() 执行迁移；或在 Supabase SQL Editor 手动执行 storage-pg 中的 ALTER TABLE。"
      );
      process.exit(1);
    }
    console.log("\n✅ 表结构检查通过。");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
