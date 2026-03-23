#!/usr/bin/env node
/**
 * 将历史相对路径（/uploads/...）批量改为 S3_PUBLIC_BASE_URL 下的公网链接。
 *
 * 用法：
 *   node --env-file=.env.local scripts/migrate-public-urls-pg.mjs --dry-run
 *   node --env-file=.env.local scripts/migrate-public-urls-pg.mjs --apply
 */
import pg from "pg";

const { Pool } = pg;
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.PG_URL;
const base = (process.env.S3_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
const apply = process.argv.includes("--apply");
const dryRun = !apply;

if (!dbUrl) {
  console.error("❌ 缺少 DATABASE_URL / SUPABASE_DB_URL / PG_URL");
  process.exit(1);
}
if (!base) {
  console.error("❌ 缺少 S3_PUBLIC_BASE_URL");
  process.exit(1);
}

function rewriteUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return s;
  if (s.startsWith("/uploads/videos/")) return `${base}/videos/${s.slice("/uploads/videos/".length)}`;
  if (s.startsWith("/uploads/covers/")) return `${base}/covers/${s.slice("/uploads/covers/".length)}`;
  if (s.startsWith("/videos/")) return `${base}/videos/${s.slice("/videos/".length)}`;
  if (s.startsWith("/covers/")) return `${base}/covers/${s.slice("/covers/".length)}`;
  return s;
}

async function main() {
  const pool = new Pool({
    connectionString: dbUrl,
    ssl:
      dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false }
  });
  try {
    const { rows: seriesRows } = await pool.query(
      "SELECT id, cover, poster FROM series ORDER BY created_at DESC NULLS LAST"
    );
    const { rows: episodeRows } = await pool.query(
      "SELECT id, video_url, video_playback_url FROM episodes ORDER BY series_id, ep_index"
    );

    const seriesPatch = [];
    for (const r of seriesRows) {
      const cover2 = rewriteUrl(r.cover);
      const poster2 = rewriteUrl(r.poster);
      if (cover2 !== r.cover || poster2 !== r.poster) {
        seriesPatch.push({ id: r.id, cover: cover2, poster: poster2 });
      }
    }

    const episodePatch = [];
    for (const r of episodeRows) {
      const videoUrl2 = rewriteUrl(r.video_url);
      const playback2 = rewriteUrl(r.video_playback_url);
      if (videoUrl2 !== r.video_url || playback2 !== r.video_playback_url) {
        episodePatch.push({ id: r.id, videoUrl: videoUrl2, videoPlaybackUrl: playback2 });
      }
    }

    console.log("=== migrate-public-urls-pg ===");
    console.log(`mode: ${dryRun ? "dry-run" : "apply"}`);
    console.log(`series to update : ${seriesPatch.length}`);
    console.log(`episodes to update: ${episodePatch.length}`);

    if (dryRun) {
      console.log("\n示例（最多 10 条）：");
      console.table(
        [...seriesPatch.slice(0, 5), ...episodePatch.slice(0, 5)].map((x) => ({
          id: x.id,
          kind: "videoUrl" in x ? "episode" : "series",
          next: "videoUrl" in x ? x.videoUrl : x.cover
        }))
      );
      return;
    }

    await pool.query("BEGIN");
    try {
      for (const s of seriesPatch) {
        await pool.query("UPDATE series SET cover = $1, poster = $2 WHERE id = $3", [
          s.cover,
          s.poster,
          s.id
        ]);
      }
      for (const e of episodePatch) {
        await pool.query(
          "UPDATE episodes SET video_url = $1, video_playback_url = $2 WHERE id = $3",
          [e.videoUrl, e.videoPlaybackUrl, e.id]
        );
      }
      await pool.query("COMMIT");
    } catch (e) {
      await pool.query("ROLLBACK");
      throw e;
    }

    console.log("✅ 更新完成");
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌ 迁移失败:", e);
  process.exit(1);
});

