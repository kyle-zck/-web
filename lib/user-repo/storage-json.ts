import fs from "fs";
import path from "path";
import type { EngagementCounts, RechargeRecord, StoredUser, WatchHistoryEntry } from "./types";

const DATA_DIR = path.resolve(process.cwd(), "data");
const USERS_PATH = path.join(DATA_DIR, "users.json");
const RECHARGE_PATH = path.join(DATA_DIR, "recharge-records.json");
const WATCH_HISTORY_PATH = path.join(DATA_DIR, "watch-history.json");
const USER_FAVORITES_PATH = path.join(DATA_DIR, "user-favorites.json");
const USER_LIKES_PATH = path.join(DATA_DIR, "user-likes.json");
const USER_VIEWS_PATH = path.join(DATA_DIR, "user-series-views.json");
const PAYMENT_EVENTS_PATH = path.join(DATA_DIR, "payment-events.json");

type UsersStore = { users: Record<string, StoredUser> };
type RechargeStore = { records: RechargeRecord[] };
type PaymentEventsStore = { events: Array<{ provider: string; eventId: string; sessionId?: string; uid?: string; createdAt: string }> };

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function randomUid(): string {
  return String(Math.floor(100000000 + Math.random() * 900000000));
}

function readUsers(): UsersStore {
  ensureDir();
  if (!fs.existsSync(USERS_PATH)) {
    const initial: UsersStore = { users: {} };
    fs.writeFileSync(USERS_PATH, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  const raw = fs.readFileSync(USERS_PATH, "utf-8");
  return JSON.parse(raw) as UsersStore;
}

function writeUsers(store: UsersStore) {
  ensureDir();
  fs.writeFileSync(USERS_PATH, JSON.stringify(store, null, 2), "utf-8");
}

function readRecharge(): RechargeStore {
  ensureDir();
  if (!fs.existsSync(RECHARGE_PATH)) {
    const initial: RechargeStore = { records: [] };
    fs.writeFileSync(RECHARGE_PATH, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  const raw = fs.readFileSync(RECHARGE_PATH, "utf-8");
  return JSON.parse(raw) as RechargeStore;
}

function writeRecharge(store: RechargeStore) {
  ensureDir();
  fs.writeFileSync(RECHARGE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

function readPaymentEvents(): PaymentEventsStore {
  ensureDir();
  if (!fs.existsSync(PAYMENT_EVENTS_PATH)) {
    const initial: PaymentEventsStore = { events: [] };
    fs.writeFileSync(PAYMENT_EVENTS_PATH, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  const raw = fs.readFileSync(PAYMENT_EVENTS_PATH, "utf-8");
  return JSON.parse(raw) as PaymentEventsStore;
}

function writePaymentEvents(store: PaymentEventsStore) {
  ensureDir();
  fs.writeFileSync(PAYMENT_EVENTS_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function recordPaymentEventOnce(params: {
  provider: string;
  eventId: string;
  sessionId?: string | null;
  uid?: string | null;
}): boolean {
  const provider = (params.provider ?? "").trim();
  const eventId = (params.eventId ?? "").trim();
  if (!provider || !eventId) return false;
  const store = readPaymentEvents();
  const exists = store.events.some((e) => e.provider === provider && e.eventId === eventId);
  if (exists) return false;
  store.events.push({
    provider,
    eventId,
    sessionId: (params.sessionId ?? "").trim() || undefined,
    uid: (params.uid ?? "").trim() || undefined,
    createdAt: new Date().toISOString()
  });
  writePaymentEvents(store);
  return true;
}

export function getOrCreateUid(clientId: string): StoredUser {
  const store = readUsers();
  const existing = store.users[clientId];
  if (existing) return existing;

  const uid = randomUid();
  const user: StoredUser = {
    clientId,
    uid,
    createdAt: new Date().toISOString()
  };
  store.users[clientId] = user;
  writeUsers(store);
  return user;
}

export function getUidByClientId(clientId: string): string | null {
  return readUsers().users[clientId]?.uid ?? null;
}

export function getAllUsers(): StoredUser[] {
  return Object.values(readUsers().users);
}

export function deleteUsersByUids(_uids: string[]): number {
  return 0;
}

export function addRechargeRecord(
  record: Omit<RechargeRecord, "id" | "createdAt">
): RechargeRecord {
  const store = readRecharge();
  const id = `rec-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const full: RechargeRecord = {
    ...record,
    id,
    createdAt: new Date().toISOString()
  };
  store.records.push(full);
  writeRecharge(store);
  return full;
}

export function getRechargeByUid(uid: string): RechargeRecord[] {
  const store = readRecharge();
  return store.records
    .filter((r) => r.uid === uid)
    .sort((a, b) => (b.date > a.date ? 1 : -1));
}

export function getAllRechargeRecords(): RechargeRecord[] {
  const store = readRecharge();
  return [...store.records].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

export function deleteRechargeRecordById(id: string): RechargeRecord | null {
  const store = readRecharge();
  const idx = store.records.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  const [removed] = store.records.splice(idx, 1);
  writeRecharge(store);
  return removed ?? null;
}

type WatchHistoryStore = { byClient: Record<string, WatchHistoryEntry[]> };

function readWatchHistory(): WatchHistoryStore {
  ensureDir();
  if (!fs.existsSync(WATCH_HISTORY_PATH)) {
    const initial: WatchHistoryStore = { byClient: {} };
    fs.writeFileSync(WATCH_HISTORY_PATH, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  const raw = fs.readFileSync(WATCH_HISTORY_PATH, "utf-8");
  return JSON.parse(raw) as WatchHistoryStore;
}

function writeWatchHistory(store: WatchHistoryStore) {
  ensureDir();
  fs.writeFileSync(WATCH_HISTORY_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function getWatchHistory(clientId: string): WatchHistoryEntry[] {
  return readWatchHistory().byClient[clientId] ?? [];
}

export function syncWatchHistory(clientId: string, entries: WatchHistoryEntry[]): void {
  const store = readWatchHistory();
  store.byClient[clientId] = entries;
  writeWatchHistory(store);
}

export function getAllWatchHistory(): Record<string, WatchHistoryEntry[]> {
  return readWatchHistory().byClient;
}

type UserFavoritesStore = { byClient: Record<string, string[]> };

function readUserFavorites(): UserFavoritesStore {
  ensureDir();
  if (!fs.existsSync(USER_FAVORITES_PATH)) {
    const initial: UserFavoritesStore = { byClient: {} };
    fs.writeFileSync(USER_FAVORITES_PATH, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  const raw = fs.readFileSync(USER_FAVORITES_PATH, "utf-8");
  return JSON.parse(raw) as UserFavoritesStore;
}

function writeUserFavorites(store: UserFavoritesStore) {
  ensureDir();
  fs.writeFileSync(USER_FAVORITES_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function getUserFavorites(clientId: string): string[] {
  return readUserFavorites().byClient[clientId] ?? [];
}

export function syncUserFavorites(clientId: string, seriesIds: string[]): void {
  const store = readUserFavorites();
  store.byClient[clientId] = seriesIds;
  writeUserFavorites(store);
}

export function getAllUserFavorites(): Record<string, string[]> {
  return readUserFavorites().byClient;
}

/** 各表各扫一遍 byClient，避免对每个 seriesId 重复读盘 */
export function getEngagementCountsBatch(seriesIds: string[]): Record<string, EngagementCounts> {
  const unique = [...new Set(seriesIds.filter((id) => id && id.length > 0))];
  if (unique.length === 0) return {};

  const idSet = new Set(unique);
  const out: Record<string, EngagementCounts> = {};
  for (const id of unique) {
    out[id] = { collectionCount: 0, likesCount: 0, viewsCount: 0 };
  }

  for (const list of Object.values(readUserFavorites().byClient)) {
    for (const sid of list) {
      if (idSet.has(sid)) out[sid].collectionCount += 1;
    }
  }
  for (const list of Object.values(readUserLikes().byClient)) {
    for (const sid of list) {
      if (idSet.has(sid)) out[sid].likesCount += 1;
    }
  }
  for (const list of Object.values(readUserViews().byClient)) {
    for (const sid of list) {
      if (idSet.has(sid)) out[sid].viewsCount += 1;
    }
  }
  return out;
}

export function getCollectionCount(seriesId: string): number {
  const byClient = readUserFavorites().byClient;
  return Object.values(byClient).filter((ids) => ids.includes(seriesId)).length;
}

export function getLikesCount(seriesId: string): number {
  const byClient = readUserLikes().byClient;
  return Object.values(byClient).filter((ids) => ids.includes(seriesId)).length;
}

type UserLikesStore = { byClient: Record<string, string[]> };

function readUserLikes(): UserLikesStore {
  ensureDir();
  if (!fs.existsSync(USER_LIKES_PATH)) {
    const initial: UserLikesStore = { byClient: {} };
    fs.writeFileSync(USER_LIKES_PATH, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  const raw = fs.readFileSync(USER_LIKES_PATH, "utf-8");
  return JSON.parse(raw) as UserLikesStore;
}

function writeUserLikes(store: UserLikesStore) {
  ensureDir();
  fs.writeFileSync(USER_LIKES_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function getUserLikes(clientId: string): string[] {
  return readUserLikes().byClient[clientId] ?? [];
}

export function toggleUserLike(clientId: string, seriesId: string): boolean {
  const store = readUserLikes();
  const list = store.byClient[clientId] ?? [];
  const has = list.includes(seriesId);
  store.byClient[clientId] = has
    ? list.filter((id) => id !== seriesId)
    : [...list, seriesId];
  writeUserLikes(store);
  return !has;
}

export function getAllUserLikes(): Record<string, string[]> {
  return readUserLikes().byClient;
}

type UserViewsStore = { byClient: Record<string, string[]> };

function readUserViews(): UserViewsStore {
  ensureDir();
  if (!fs.existsSync(USER_VIEWS_PATH)) {
    const initial: UserViewsStore = { byClient: {} };
    fs.writeFileSync(USER_VIEWS_PATH, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  const raw = fs.readFileSync(USER_VIEWS_PATH, "utf-8");
  return JSON.parse(raw) as UserViewsStore;
}

function writeUserViews(store: UserViewsStore) {
  ensureDir();
  fs.writeFileSync(USER_VIEWS_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function getViewsCount(seriesId: string): number {
  const byClient = readUserViews().byClient;
  return Object.values(byClient).filter((ids) => ids.includes(seriesId)).length;
}

export function recordSeriesView(clientId: string, seriesId: string): boolean {
  const store = readUserViews();
  const list = store.byClient[clientId] ?? [];
  if (list.includes(seriesId)) return false;
  store.byClient[clientId] = [...list, seriesId];
  writeUserViews(store);
  return true;
}

export function getAllUserViews(): Record<string, string[]> {
  return readUserViews().byClient;
}
