import { unstable_cache } from "next/cache";
import { engagementSeriesTag } from "@/lib/cache/cache-tags";
import {
  redisEngagementMGet,
  redisEngagementMSet
} from "@/lib/cache/engagement-distributed-cache";
import { isRedisConfigured } from "@/lib/cache/redis-client";
import { getDatabaseUrl } from "@/lib/db/url";
import type {
  AdminUserQuery,
  AdminUserSafe,
  EngagementCounts,
  RechargeRecord,
  StoredUser,
  WatchHistoryEntry
} from "./types";
import * as json from "./storage-json";
import * as pg from "./storage-pg";

/**
 * 与剧目存储一致：`SERIES_STORAGE=pg` 且已配置 DATABASE_URL 时，用户数据走 PostgreSQL；
 * 否则仍用本地 `data/*.json`（仅适合本机开发）。
 */
function shouldUsePgStorage(): boolean {
  // 用户数据优先入库；不强绑定 SERIES_STORAGE，避免本地 series 用文件而用户仍希望入库
  return Boolean(getDatabaseUrl());
}

export async function getOrCreateUid(clientId: string): Promise<StoredUser> {
  if (shouldUsePgStorage()) return pg.getOrCreateUid(clientId);
  return json.getOrCreateUid(clientId);
}

export async function getUidByClientId(clientId: string): Promise<string | null> {
  if (shouldUsePgStorage()) return pg.getUidByClientId(clientId);
  return Promise.resolve(json.getUidByClientId(clientId));
}

export async function getAllUsers(): Promise<StoredUser[]> {
  if (shouldUsePgStorage()) return pg.getAllUsers();
  return Promise.resolve(json.getAllUsers());
}

export async function adminQueryUsers(query: AdminUserQuery): Promise<AdminUserSafe[]> {
  if (!shouldUsePgStorage()) {
    // 必存字段要求：未配 PG 时，后台查询直接返回空（避免误用本地 JSON）
    return [];
  }
  return pg.adminQueryUsers(query);
}

export async function touchGuestLogin(params: {
  clientId: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  if (!shouldUsePgStorage()) return;
  return pg.touchGuestLogin(params);
}

export async function upsertSignedInUser(params: {
  uid: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  provider: "google" | "facebook" | "apple" | "";
  providerSub: string;
  ip?: string | null;
  userAgent?: string | null;
  createdAt?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: number | null;
}): Promise<void> {
  if (!shouldUsePgStorage()) return;
  return pg.upsertSignedInUser(params);
}

export async function getOrCreateUidForProvider(params: {
  provider: "google" | "facebook" | "apple" | "";
  providerSub: string;
}): Promise<string | null> {
  if (!shouldUsePgStorage()) return null;
  if (!params.provider || !params.providerSub) return null;
  return pg.getOrCreateUidForProvider(params);
}

export async function addRechargeRecord(
  record: Omit<RechargeRecord, "id" | "createdAt">
): Promise<RechargeRecord> {
  if (shouldUsePgStorage()) return pg.addRechargeRecord(record);
  return Promise.resolve(json.addRechargeRecord(record));
}

export async function getRechargeByUid(uid: string): Promise<RechargeRecord[]> {
  if (shouldUsePgStorage()) return pg.getRechargeByUid(uid);
  return Promise.resolve(json.getRechargeByUid(uid));
}

export async function getAllRechargeRecords(): Promise<RechargeRecord[]> {
  if (shouldUsePgStorage()) return pg.getAllRechargeRecords();
  return Promise.resolve(json.getAllRechargeRecords());
}

export async function deleteRechargeRecordById(id: string): Promise<RechargeRecord | null> {
  if (shouldUsePgStorage()) return pg.deleteRechargeRecordById(id);
  return Promise.resolve(json.deleteRechargeRecordById(id));
}

export async function grantMembershipByUid(params: {
  uid: string;
  planLabel: string;
  remainingDays: number;
}): Promise<void> {
  if (!shouldUsePgStorage()) return;
  return pg.grantMembershipByUid(params);
}

export async function getWatchHistory(clientId: string): Promise<WatchHistoryEntry[]> {
  if (shouldUsePgStorage()) return pg.getWatchHistory(clientId);
  return Promise.resolve(json.getWatchHistory(clientId));
}

export async function syncWatchHistory(
  clientId: string,
  entries: WatchHistoryEntry[]
): Promise<void> {
  if (shouldUsePgStorage()) return pg.syncWatchHistory(clientId, entries);
  json.syncWatchHistory(clientId, entries);
  return Promise.resolve();
}

export async function getAllWatchHistory(): Promise<Record<string, WatchHistoryEntry[]>> {
  if (shouldUsePgStorage()) return pg.getAllWatchHistory();
  return Promise.resolve(json.getAllWatchHistory());
}

export async function getUserFavorites(clientId: string): Promise<string[]> {
  if (shouldUsePgStorage()) return pg.getUserFavorites(clientId);
  return Promise.resolve(json.getUserFavorites(clientId));
}

export async function syncUserFavorites(clientId: string, seriesIds: string[]): Promise<void> {
  if (shouldUsePgStorage()) return pg.syncUserFavorites(clientId, seriesIds);
  json.syncUserFavorites(clientId, seriesIds);
  return Promise.resolve();
}

export async function getAllUserFavorites(): Promise<Record<string, string[]>> {
  if (shouldUsePgStorage()) return pg.getAllUserFavorites();
  return Promise.resolve(json.getAllUserFavorites());
}

function parseEngagementCacheRevalidate(): number {
  const raw = process.env.PUBLIC_ENGAGEMENT_COUNTS_REVALIDATE;
  if (raw == null || raw === "") return 20;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 5 ? Math.floor(n) : 20;
}

function engagementBatchCacheKey(ids: string[]): string {
  return [...new Set(ids)].sort().join("\u0001");
}

/**
 * 批量取收藏/点赞/观看数。
 * - 配置 REDIS_URL 时：按剧维度读穿 Redis，多实例共享；未命中再打 PG/JSON 并回写。
 * - 未配置 Redis：Next Data Cache（短 TTL）+ `engagement-series-{id}` 标签，供 revalidateTag 精准失效。
 */
export async function getEngagementCountsBatch(
  ids: string[]
): Promise<Record<string, EngagementCounts>> {
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))];
  if (unique.length === 0) return {};

  if (isRedisConfigured()) {
    try {
      const { hits, misses } = await redisEngagementMGet(unique);
      if (misses.length === 0) {
        return hits;
      }
      const filled = shouldUsePgStorage()
        ? await pg.getEngagementCountsBatch(misses)
        : json.getEngagementCountsBatch(misses);
      await redisEngagementMSet(filled);
      return { ...hits, ...filled };
    } catch {
      // Redis 不可用时回退到下方 Next 缓存
    }
  }

  const ttl = parseEngagementCacheRevalidate();
  const key = engagementBatchCacheKey(unique);
  const tags = unique.map((id) => engagementSeriesTag(id));

  if (shouldUsePgStorage()) {
    return unstable_cache(
      () => pg.getEngagementCountsBatch(unique),
      ["engagement-counts-batch", key],
      { revalidate: ttl, tags }
    )();
  }

  return unstable_cache(
    async () => json.getEngagementCountsBatch(unique),
    ["engagement-counts-batch-json", key],
    { revalidate: ttl, tags }
  )();
}

export async function getCollectionCount(seriesId: string): Promise<number> {
  if (shouldUsePgStorage()) return pg.getCollectionCount(seriesId);
  return Promise.resolve(json.getCollectionCount(seriesId));
}

export async function getLikesCount(seriesId: string): Promise<number> {
  if (shouldUsePgStorage()) return pg.getLikesCount(seriesId);
  return Promise.resolve(json.getLikesCount(seriesId));
}

export async function getUserLikes(clientId: string): Promise<string[]> {
  if (shouldUsePgStorage()) return pg.getUserLikes(clientId);
  return Promise.resolve(json.getUserLikes(clientId));
}

export async function toggleUserLike(clientId: string, seriesId: string): Promise<boolean> {
  if (shouldUsePgStorage()) return pg.toggleUserLike(clientId, seriesId);
  return Promise.resolve(json.toggleUserLike(clientId, seriesId));
}

export async function getAllUserLikes(): Promise<Record<string, string[]>> {
  if (shouldUsePgStorage()) return pg.getAllUserLikes();
  return Promise.resolve(json.getAllUserLikes());
}

export async function getViewsCount(seriesId: string): Promise<number> {
  if (shouldUsePgStorage()) return pg.getViewsCount(seriesId);
  return Promise.resolve(json.getViewsCount(seriesId));
}

export async function recordSeriesView(clientId: string, seriesId: string): Promise<boolean> {
  if (shouldUsePgStorage()) return pg.recordSeriesView(clientId, seriesId);
  return Promise.resolve(json.recordSeriesView(clientId, seriesId));
}

export async function getAllUserViews(): Promise<Record<string, string[]>> {
  if (shouldUsePgStorage()) return pg.getAllUserViews();
  return Promise.resolve(json.getAllUserViews());
}
