/**
 * 本地与线上配置对比脚本
 * 运行方式：npx ts-node scripts/check-env-sync.ts
 * （也可先 export $(grep -v '^#' .env.local | xargs) 再运行，或 node --env-file=.env.local 配合可执行入口）
 */

import path from "path";
import { existsSync, readFileSync, promises as fs } from "fs";
import { Pool } from "pg";
import { getDatabaseUrl } from "../lib/db/url";

/** 与 dotenv 行为接近的轻量解析，避免引入额外依赖导致 next build 类型检查失败 */
function loadEnvLocalFile(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const unexported = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = unexported.indexOf("=");
    if (eq === -1) continue;
    const key = unexported.slice(0, eq).trim();
    if (!key) continue;
    let value = unexported.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvLocalFile();

const appConfigLocalPath = path.join(process.cwd(), "data", "app-config.json");

async function fetchPgAppConfig(): Promise<Record<string, unknown> | null> {
  const url = getDatabaseUrl();
  if (!url) {
    console.log("❌ 未配置 DATABASE_URL，无法连接线上数据库");
    return null;
  }

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    const { rows } = await pool.query(
      `SELECT config_json FROM site_config_snapshot WHERE id = 1`
    );
    if (rows.length > 0) {
      return rows[0].config_json as Record<string, unknown>;
    }
    return null;
  } catch (e) {
    console.error("❌ 查询线上 app-config 失败:", e);
    return null;
  } finally {
    await pool.end();
  }
}

async function fetchPgSeriesCount(): Promise<number> {
  const url = getDatabaseUrl();
  if (!url) return 0;

  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    const { rows } = await pool.query(`SELECT COUNT(*) as count FROM drama_series`);
    return parseInt(rows[0].count as string, 10);
  } catch {
    return 0;
  } finally {
    await pool.end();
  }
}

function compareObjects(local: unknown, remote: unknown, path: string = ""): void {
  const indent = "  ".repeat(path.split(".").length);

  if (typeof local !== typeof remote || local === null || remote === null) {
    if (JSON.stringify(local) !== JSON.stringify(remote)) {
      console.log(`${indent}🔴 ${path || "root"}:`);
      console.log(`${indent}   本地: ${JSON.stringify(local)}`);
      console.log(`${indent}   线上: ${JSON.stringify(remote)}`);
    }
    return;
  }

  if (typeof local === "object" && !Array.isArray(local)) {
    const localObj = local as Record<string, unknown>;
    const remoteObj = remote as Record<string, unknown>;
    const allKeys = new Set([...Object.keys(localObj), ...Object.keys(remoteObj)]);

    for (const key of allKeys) {
      const newPath = path ? `${path}.${key}` : key;
      if (!(key in localObj)) {
        console.log(`${indent}🟢 ${newPath}: 线上独有`);
        console.log(`${indent}   线上: ${JSON.stringify(remoteObj[key])}`);
      } else if (!(key in remoteObj)) {
        console.log(`${indent}🟡 ${newPath}: 本地独有`);
        console.log(`${indent}   本地: ${JSON.stringify(localObj[key])}`);
      } else {
        compareObjects(localObj[key], remoteObj[key], newPath);
      }
    }
  } else if (Array.isArray(local) && Array.isArray(remote)) {
    if (JSON.stringify(local) !== JSON.stringify(remote)) {
      console.log(`${indent}🔴 ${path}:`);
      console.log(`${indent}   本地长度: ${local.length}, 线上长度: ${remote.length}`);
      console.log(`${indent}   本地[0]: ${JSON.stringify(local[0])}`);
      console.log(`${indent}   线上[0]: ${JSON.stringify(remote[0])}`);
    }
  } else if (JSON.stringify(local) !== JSON.stringify(remote)) {
    console.log(`${indent}🔴 ${path}:`);
    console.log(`${indent}   本地: ${JSON.stringify(local)}`);
    console.log(`${indent}   线上: ${JSON.stringify(remote)}`);
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("📊 本地与线上配置对比工具");
  console.log("=".repeat(60));

  // 1. 环境变量状态
  console.log("\n📌 环境变量状态:");
  console.log(`   SERIES_STORAGE: ${process.env.SERIES_STORAGE || "(未设置，默认 local)"}`);
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? "✅ 已配置" : "❌ 未配置"}`);
  console.log(`   NEXT_PUBLIC_SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL || "(未设置)"}`);
  console.log(`   NEXT_PUBLIC_SITE_URL: ${process.env.NEXT_PUBLIC_SITE_URL || "(未设置)"}`);

  // 2. 本地 app-config.json
  console.log("\n📄 本地 app-config.json:");
  let localAppConfig: Record<string, unknown> = {};
  try {
    const content = await fs.readFile(appConfigLocalPath, "utf8");
    localAppConfig = JSON.parse(content);
    console.log("   ✅ 已读取");
    console.log(`   - subscriptionPlans: ${(localAppConfig.subscriptionPlans as unknown[])?.length || 0} 个`);
    console.log(`   - store.paymentMethods: ${((localAppConfig.store as Record<string, unknown>)?.paymentMethods as unknown[])?.length || 0} 个`);
  } catch {
    console.log("   ❌ 文件不存在或读取失败");
  }

  // 3. 线上 app-config (从 PG)
  console.log("\n🌐 线上 app-config (从 Supabase PostgreSQL):");
  const remoteAppConfig = await fetchPgAppConfig();
  if (remoteAppConfig) {
    console.log("   ✅ 已获取");
    console.log(`   - subscriptionPlans: ${(remoteAppConfig.subscriptionPlans as unknown[])?.length || 0} 个`);
    console.log(`   - store.paymentMethods: ${((remoteAppConfig.store as Record<string, unknown>)?.paymentMethods as unknown[])?.length || 0} 个`);
  } else {
    console.log("   ❌ 无法获取线上配置");
  }

  // 4. 对比 app-config
  if (Object.keys(localAppConfig).length > 0 && remoteAppConfig && Object.keys(remoteAppConfig).length > 0) {
    console.log("\n🔍 app-config 差异分析:");
    compareObjects(localAppConfig, remoteAppConfig);
  } else {
    console.log("\n⚠️ 无法进行对比（缺少本地或线上数据）");
  }

  // 5. 剧集数量对比
  console.log("\n📺 剧集数量:");
  const pgSeriesCount = await fetchPgSeriesCount();
  let localSeriesCount = 0;
  try {
    const seriesPath = path.join(process.cwd(), "data", "series-store.json");
    const content = await fs.readFile(seriesPath, "utf8");
    const data = JSON.parse(content);
    localSeriesCount = Array.isArray(data) ? data.length : (data.series?.length || 0);
    console.log(`   本地 series-store.json: ${localSeriesCount} 个`);
  } catch {
    console.log(`   本地 series-store.json: 0 个 (文件不存在)`);
  }
  console.log(`   线上 PostgreSQL: ${pgSeriesCount} 个`);

  if (localSeriesCount !== pgSeriesCount) {
    console.log(`   ⚠️ 剧集数量不一致！差异: ${Math.abs(localSeriesCount - pgSeriesCount)}`);
  }

  // 6. 同步建议
  console.log("\n" + "=".repeat(60));
  console.log("💡 同步建议:");
  console.log("=".repeat(60));

  if (process.env.SERIES_STORAGE !== "pg") {
    console.log("1. ⚠️  SERIES_STORAGE 未设置为 pg，建议改为 'pg' 以使用线上数据");
  }

  if (process.env.DEV_APP_CONFIG_USE_PG === "0") {
    console.log("2. ⚠️  DEV_APP_CONFIG_USE_PG=0 会强制读取本地 JSON");
    console.log("   建议删除此变量或设为 1，以从线上 PG 读取配置");
  }

  if (localSeriesCount !== pgSeriesCount) {
    console.log("3. 📦 剧集数据不同步：");
    console.log("   - 本地使用 data/series-store.json");
    console.log("   - 线上使用 PostgreSQL");
    console.log("   - 建议在后台管理页面上传/管理剧集，或直接操作数据库");
  }

  console.log("\n4. 🔄 强制从线上同步 app-config:");
  console.log("   启动开发服务器后访问 /admin → 站点与展示 → 保存一次配置");
  console.log("   这会将线上 PG 配置同步到本地 JSON（或相反）");

  console.log("\n5. 📝 手动同步命令:");
  console.log("   # 导出线上 app-config 到本地:");
  console.log("   # 需要在 Supabase Dashboard 的 SQL Editor 中执行");
  console.log("   SELECT config_json FROM site_config_snapshot WHERE id = 1;");
  console.log("\n   # 导出线上剧集数据到本地:");
  console.log("   # 需要在 Supabase Dashboard 中导出 drama_series 表");
}

main().catch(console.error);
