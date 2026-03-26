export interface StoredUser {
  clientId: string;
  uid: string;
  createdAt: string;
}

export type UserType = "guest" | "sign-in";
export type LoginProvider = "google" | "facebook" | "apple" | "";
export type AccountStatus = "active" | "disabled";
export type DeviceType = "ios" | "android" | "web" | "unknown";

/** 后台展示用（不含任何敏感 token / openid） */
export type AdminUserSafe = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  provider: LoginProvider;
  createdAt: string;
  lastLoginAt: string;
  lastLoginIp: string;
  status: AccountStatus;
  membershipPlan: string;
  membershipExpiresAt: string;
  deviceType: DeviceType;
};

export type AdminUserQuery = {
  uid?: string;
  name?: string;
  email?: string;
  provider?: LoginProvider;
  membershipPlan?: string;
  /** 套餐剩余时间排序 */
  remainingSort?: "remainingAsc" | "remainingDesc";
};

export interface RechargeRecord {
  id: string;
  uid: string;
  date: string;
  price: number;
  tier: string;
  rechargeDays: number;
  createdAt: string;
}

export interface WatchHistoryEntry {
  seriesId: string;
  episodeIndex: number;
  seconds: number;
  lastWatchedAt: string;
}

/** 剧目维度互动计数（收藏 / 点赞 / 观看人数） */
export type EngagementCounts = {
  collectionCount: number;
  likesCount: number;
  viewsCount: number;
};
