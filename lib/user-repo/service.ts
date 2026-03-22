import { getDatabaseUrl } from "@/lib/db/url";
import type { RechargeRecord, StoredUser, WatchHistoryEntry } from "./types";
import * as json from "./storage-json";
import * as pg from "./storage-pg";

/**
 * 与剧目存储一致：`SERIES_STORAGE=pg` 且已配置 DATABASE_URL 时，用户数据走 PostgreSQL；
 * 否则仍用本地 `data/*.json`（仅适合本机开发）。
 */
function shouldUsePgStorage(): boolean {
  return process.env.SERIES_STORAGE === "pg" && Boolean(getDatabaseUrl());
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
