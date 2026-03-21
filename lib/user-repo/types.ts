export interface StoredUser {
  clientId: string;
  uid: string;
  createdAt: string;
}

export interface RechargeRecord {
  id: string;
  uid: string;
  date: string;
  price: number;
  tier: string;
  createdAt: string;
}

export interface WatchHistoryEntry {
  seriesId: string;
  episodeIndex: number;
  seconds: number;
  lastWatchedAt: string;
}
