import { promises as fs } from "fs";
import path from "path";
import { cache } from "react";
import { deepMerge } from "@/lib/app-config/merge";
import { getAdminPgPool } from "@/lib/admin/admin-pg";
import type { AdminAssetConfig, AccessListConfig, RechargeTemplate } from "./types";
import * as pgStore from "./storage-pg";

const CONFIG_PATH = path.join(process.cwd(), "data", "admin-asset-config.json");

function nowIso() {
  return new Date().toISOString();
}

function defaultAccessList(): AccessListConfig {
  return {
    whitelistClientIds: [],
    blacklistClientIds: [],
    updatedAt: nowIso()
  };
}

export const DEFAULT_ADMIN_ASSET_CONFIG: AdminAssetConfig = {
  rechargeTemplates: [],
  accessList: defaultAccessList(),
  updatedAt: nowIso()
};

function cloneDefault(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(DEFAULT_ADMIN_ASSET_CONFIG)) as Record<string, unknown>;
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

export async function readAdminAssetStoredRaw(): Promise<Record<string, unknown>> {
  try {
    const fromPg = await pgStore.readAdminAssetConfigJson();
    if (fromPg != null && Object.keys(fromPg).length > 0) return fromPg;
  } catch (e) {
    console.error("[admin-asset-config] read pg failed, fallback file:", e);
  }
  return readFileRaw();
}

async function writeAdminAssetStoredRaw(data: Record<string, unknown>): Promise<void> {
  try {
    // 若配置了 PG：优先写 PG；失败再回退文件
    if (getAdminPgPool()) {
      await pgStore.upsertAdminAssetConfigJson(data);
      return;
    }
  } catch (e) {
    console.error("[admin-asset-config] write pg failed, fallback file:", e);
  }
  await writeFileRaw(data);
}

export async function getAdminAssetConfig(): Promise<AdminAssetConfig> {
  const raw = await readAdminAssetStoredRaw();
  return deepMerge(cloneDefault(), raw) as unknown as AdminAssetConfig;
}

export async function getAdminAssetConfigOrDefault(): Promise<AdminAssetConfig> {
  try {
    return await getAdminAssetConfig();
  } catch (e) {
    console.error("[admin-asset-config] get config failed, using default", e);
    return JSON.parse(JSON.stringify(DEFAULT_ADMIN_ASSET_CONFIG)) as AdminAssetConfig;
  }
}

export async function saveAdminAssetConfig(
  patch: Partial<AdminAssetConfig>
): Promise<AdminAssetConfig> {
  const raw = await readAdminAssetStoredRaw();
  const nextRaw = deepMerge(raw, {
    ...patch,
    updatedAt: nowIso()
  } as Record<string, unknown>);
  await writeAdminAssetStoredRaw(nextRaw);
  return getAdminAssetConfigOrDefault();
}

export async function replaceRechargeTemplates(
  templates: RechargeTemplate[]
): Promise<AdminAssetConfig> {
  return saveAdminAssetConfig({ rechargeTemplates: templates });
}

export async function replaceAccessList(accessList: AccessListConfig): Promise<AdminAssetConfig> {
  return saveAdminAssetConfig({
    accessList: {
      ...accessList,
      updatedAt: nowIso()
    }
  });
}

export const getCachedAdminAssetConfig = cache(async (): Promise<AdminAssetConfig> => {
  return getAdminAssetConfigOrDefault();
});

