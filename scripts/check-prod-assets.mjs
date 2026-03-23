#!/usr/bin/env node
/**
 * 扫描数据库资源链接在生产环境是否可访问（重点找 404）。
 *
 * 用法：
 *   node --env-file=.env.local scripts/check-prod-assets.mjs
 *
 * 可选环境变量：
 *   PROD_BASE_URL=https://your-site.vercel.app   // 用于补全 /uploads/... 这类相对路径
 *   CHECK_CONCURRENCY=8                           // 并发检查数（默认 8）
 *   CHECK_TIMEOUT_MS=12000                        // 单个请求超时（默认 12000ms）
 *   CHECK_HEAD_ONLY=0                             // 设为 1 时仅 HEAD，不回退 GET
 */

import fs from "fs";
import path from "path";
import pg from "pg";

const { Pool } = pg;
const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.PG_URL;
const prodBaseUrl = (process.env.PROD_BASE_URL || "").trim().replace(/\/+$/, "");
const concurrency = Math.max(1, Number(process.env.CHECK_CONCURRENCY || 8));
const timeoutMs = Math.max(1000, Number(process.env.CHECK_TIMEOUT_MS || 12000));
const headOnly = String(process.env.CHECK_HEAD_ONLY || "0") === "1";

if (!dbUrl) {
  console.error("❌ 未找到 DATABASE_URL / SUPABASE_DB_URL / PG_URL");
  process.exit(1);
}

if (!prodBaseUrl) {
  console.warn("⚠️ 未配置 PROD_BASE_URL，相对路径（如 /uploads/...）将无法检查。");
}

function normalizeUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/") && prodBaseUrl) return `${prodBaseUrl}${s}`;
  return null;
}

async function fetchWithTimeout(url, method) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "asset-checker/1.0"
      }
    });
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(url) {
  const head = await fetchWithTimeout(url, "HEAD");
  if (head.ok && head.status !== 405) return head;
  if (!headOnly) {
    const get = await fetchWithTimeout(url, "GET");
    if (get.ok) return get;
  }
  return head;
}

function pickSeverity(status) {
  if (status === 404) return "error";
  if (status >= 400) return "warn";
  return "ok";
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
    const { rows } = await pool.query(`
      SELECT
        s.id AS series_id,
        s.drama_id,
        s.title AS series_title,
        s.cover AS cover_url,
        e.id AS episode_id,
        e.ep_index,
        e.video_url,
        e.video_playback_url
      FROM series s
      LEFT JOIN episodes e ON e.series_id = s.id
      ORDER BY s.created_at DESC NULLS LAST, e.ep_index ASC NULLS LAST
    `);

    const targets = [];
    for (const r of rows) {
      const baseMeta = {
        seriesId: r.series_id,
        dramaId: r.drama_id,
        seriesTitle: r.series_title,
        episodeId: r.episode_id || null,
        epIndex: r.ep_index || null
      };

      if (r.cover_url) {
        targets.push({
          kind: "cover",
          field: "cover",
          rawUrl: r.cover_url,
          url: normalizeUrl(r.cover_url),
          ...baseMeta
        });
      }
      if (r.video_url) {
        targets.push({
          kind: "episode",
          field: "videoUrl",
          rawUrl: r.video_url,
          url: normalizeUrl(r.video_url),
          ...baseMeta
        });
      }
      if (r.video_playback_url) {
        targets.push({
          kind: "episode",
          field: "videoPlaybackUrl",
          rawUrl: r.video_playback_url,
          url: normalizeUrl(r.video_playback_url),
          ...baseMeta
        });
      }
    }

    const uniqueByUrl = new Map();
    for (const t of targets) {
      const k = `${t.field}::${t.rawUrl}`;
      if (!uniqueByUrl.has(k)) uniqueByUrl.set(k, t);
    }
    const uniqueTargets = [...uniqueByUrl.values()];

    let idx = 0;
    const results = [];
    const workers = Array.from({ length: Math.min(concurrency, uniqueTargets.length) }).map(
      async () => {
        while (idx < uniqueTargets.length) {
          const cur = uniqueTargets[idx++];
          if (!cur.url) {
            results.push({
              ...cur,
              status: 0,
              severity: "warn",
              reason: "uncheckable_relative_or_invalid_url"
            });
            continue;
          }
          const r = await checkUrl(cur.url);
          const status = r.status || 0;
          results.push({
            ...cur,
            status,
            severity: pickSeverity(status),
            reason: r.ok ? "" : r.error || "request_failed"
          });
        }
      }
    );
    await Promise.all(workers);

    const broken = results.filter((x) => x.status === 404);
    const bad = results.filter((x) => x.status >= 400 || x.status === 0);

    console.log("\n=== 资源自检结果 ===");
    console.log(`总检查链接: ${results.length}`);
    console.log(`404 数量   : ${broken.length}`);
    console.log(`异常数量   : ${bad.length}`);

    const preview = bad.slice(0, 80).map((x) => ({
      dramaId: x.dramaId,
      seriesId: x.seriesId,
      epIndex: x.epIndex,
      field: x.field,
      status: x.status,
      rawUrl: String(x.rawUrl).slice(0, 120),
      reason: x.reason
    }));
    if (preview.length > 0) {
      console.log("\n=== 异常预览（最多 80 条）===");
      console.table(preview);
    } else {
      console.log("\n✅ 未发现异常链接。");
    }

    const outDir = path.resolve(process.cwd(), "scripts", "reports");
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outPath = path.join(outDir, `prod-assets-check-${stamp}.json`);
    fs.writeFileSync(
      outPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          prodBaseUrl,
          summary: {
            total: results.length,
            notFound404: broken.length,
            badOrUnknown: bad.length
          },
          items: results
        },
        null,
        2
      ),
      "utf8"
    );
    console.log(`\n详细报告已写入: ${outPath}`);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌ 扫描失败:", e);
  process.exit(1);
});

