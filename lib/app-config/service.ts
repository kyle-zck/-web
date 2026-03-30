import { promises as fs } from "fs";
import path from "path";
import { cache } from "react";
import { getDatabaseUrl } from "@/lib/db/url";
import { DEFAULT_APP_CONFIG } from "./defaults";
import { deepMerge } from "./merge";
import type { AppConfig } from "./types";
import * as appSitePg from "./storage-pg";

const CONFIG_PATH = path.join(process.cwd(), "data", "app-config.json");

/** `next build` 静态生成会大量并发调用 getAppConfig；跳过远程 PG，避免连库超时或锁竞争 */
function skipPgDuringNextBuild(): boolean {
  if (process.env.NEXT_SKIP_APP_CONFIG_PG === "1") return true;
  if (process.env.npm_lifecycle_event === "build") return true;
  if (process.env.NEXT_PHASE === "phase-production-build") return true;
  // 开发：已配置数据库时默认读 PG（与线上一致）；仅本地 JSON 时设 DEV_APP_CONFIG_USE_PG=0
  if (process.env.NODE_ENV === "development") {
    if (process.env.DEV_APP_CONFIG_USE_PG === "0") return true;
    if (process.env.DEV_APP_CONFIG_USE_PG === "1") return false;
    return !getDatabaseUrl();
  }
  return false;
}

export function shouldUsePgStorage(): boolean {
  if (skipPgDuringNextBuild()) return false;
  // 线上只要配置了 DATABASE_URL 就优先入库，避免因 SERIES_STORAGE 未设为 pg
  // 回退到只读文件系统导致保存失败。
  return Boolean(getDatabaseUrl());
}

function cloneDefault(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(DEFAULT_APP_CONFIG)) as Record<string, unknown>;
}

async function readFileRaw(): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const j = JSON.parse(raw) as unknown;
    return typeof j === "object" && j !== null && !Array.isArray(j)
      ? (j as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function writeFileRaw(data: Record<string, unknown>): Promise<void> {
  const dir = path.dirname(CONFIG_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(data, null, 2), "utf8");
}

/**
 * 仅持久化层原始 JSON（不含与 DEFAULT 的合并结果）
 */
export async function readStoredRaw(): Promise<Record<string, unknown>> {
  if (shouldUsePgStorage()) {
    try {
      const fromPg = await appSitePg.readAppSiteConfigJson();
      if (fromPg != null && Object.keys(fromPg).length > 0) {
        return fromPg;
      }
      const fromFile = await readFileRaw();
      if (Object.keys(fromFile).length > 0) {
        await appSitePg.upsertAppSiteConfigJson(fromFile);
        return fromFile;
      }
      return fromPg ?? {};
    } catch (e) {
      console.error("[app-config] read pg failed, fallback file:", e);
      return readFileRaw();
    }
  }
  return readFileRaw();
}

async function writeStoredRaw(data: Record<string, unknown>): Promise<void> {
  if (shouldUsePgStorage()) {
    try {
      await appSitePg.upsertAppSiteConfigJson(data);
      return;
    } catch (e) {
      console.error("[app-config] write pg failed, fallback file:", e);
    }
  }
  // 生产环境（尤其是 Vercel）文件系统通常只读：未配置数据库时不要回退写文件，以免 EROFS。
  const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";
  if (process.env.NODE_ENV === "production" || isVercel) {
    throw new Error(
      "app-config persistence is not configured: set DATABASE_URL (or SUPABASE_DB_URL/PG_URL) in production"
    );
  }
  await writeFileRaw(data);
}

export async function getAppConfig(): Promise<AppConfig> {
  const raw = await readStoredRaw();
  return deepMerge(cloneDefault(), raw) as unknown as AppConfig;
}

/** 进程内短缓存：减轻 PG/磁盘读与 deepMerge；与 GET /api/app-config 的 s-maxage 协同 */
let appConfigMem:
  | { payload: string; expiresAt: number }
  | null = null;

function appConfigCacheTtlMs(): number {
  const raw = process.env.APP_CONFIG_CACHE_MS?.trim();
  if (raw === "0") return 0;
  if (raw != null && raw !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.min(n, 300_000);
  }
  return 25_000;
}

export function invalidateAppConfigMemoryCache(): void {
  appConfigMem = null;
}

/** 读配置失败时回退默认，避免根 layout / metadata 抛错导致白屏与 “missing required error components” */
export async function getAppConfigOrDefault(): Promise<AppConfig> {
  const ttl = appConfigCacheTtlMs();
  const now = Date.now();
  if (ttl > 0 && appConfigMem && appConfigMem.expiresAt > now) {
    return JSON.parse(appConfigMem.payload) as AppConfig;
  }
  try {
    const cfg = await getAppConfig();
    if (ttl > 0) {
      appConfigMem = { payload: JSON.stringify(cfg), expiresAt: now + ttl };
    }
    return cfg;
  } catch (e) {
    console.error("[app-config] getAppConfig failed, using DEFAULT_APP_CONFIG", e);
    return JSON.parse(JSON.stringify(DEFAULT_APP_CONFIG)) as AppConfig;
  }
}

export async function saveAppConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  const raw = await readStoredRaw();
  const nextRaw = deepMerge(raw, patch as Record<string, unknown>);
  await writeStoredRaw(nextRaw);
  invalidateAppConfigMemoryCache();
  return getAppConfigOrDefault();
}

/**
 * 同一请求内 layout + metadata + 页面若多次读配置，只执行一次 I/O（React cache）
 */
export const getCachedAppConfig = cache(async (): Promise<AppConfig> => {
  return getAppConfigOrDefault();
});
