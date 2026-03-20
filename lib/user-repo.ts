import fs from "fs";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "data");
const USERS_PATH = path.join(DATA_DIR, "users.json");
const RECHARGE_PATH = path.join(DATA_DIR, "recharge-records.json");
const WATCH_HISTORY_PATH = path.join(DATA_DIR, "watch-history.json");
const USER_FAVORITES_PATH = path.join(DATA_DIR, "user-favorites.json");
const USER_LIKES_PATH = path.join(DATA_DIR, "user-likes.json");

export interface StoredUser {
  clientId: string;
  uid: string;
  createdAt: string;
}

export interface RechargeRecord {
  id: string;
  uid: string;
  date: string; // YYYY-MM-DD
  price: number;
  tier: string;
  createdAt: string;
}

type UsersStore = { users: Record<string, StoredUser> };
type RechargeStore = { records: RechargeRecord[] };

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

/** 获取或创建用户 UID，管理后台自动分配 */
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

/** 根据 clientId 获取 UID */
export function getUidByClientId(clientId: string): string | null {
  return readUsers().users[clientId]?.uid ?? null;
}

/** 获取所有用户列表 */
export function getAllUsers(): StoredUser[] {
  return Object.values(readUsers().users);
}

/** 添加充值记录 */
export function addRechargeRecord(record: Omit<RechargeRecord, "id" | "createdAt">): RechargeRecord {
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

/** 根据 UID 获取充值记录 */
export function getRechargeByUid(uid: string): RechargeRecord[] {
  const store = readRecharge();
  return store.records
    .filter((r) => r.uid === uid)
    .sort((a, b) => (b.date > a.date ? 1 : -1));
}

/** 获取所有充值记录（管理后台用） */
export function getAllRechargeRecords(): RechargeRecord[] {
  const store = readRecharge();
  return [...store.records].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

// --- 观看历史 ---
export interface WatchHistoryEntry {
  seriesId: string;
  episodeIndex: number;
  seconds: number;
  lastWatchedAt: string;
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

// --- 用户收藏（点赞剧目）---
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

/** 统计某剧集的收藏人数 */
export function getCollectionCount(seriesId: string): number {
  const byClient = readUserFavorites().byClient;
  return Object.values(byClient).filter((ids) => ids.includes(seriesId)).length;
}

/** 统计某剧集的喜欢人数 */
export function getLikesCount(seriesId: string): number {
  const byClient = readUserLikes().byClient;
  return Object.values(byClient).filter((ids) => ids.includes(seriesId)).length;
}

// --- 用户喜欢（点赞）---
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
