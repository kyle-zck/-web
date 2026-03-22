const KEY = "reelshort-device-client-id";

/** 匿名访客稳定 clientId，用于观看数等与后台同步（与登录 userId 二选一） */
export function getOrCreateDeviceClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = `anon-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `anon-${Date.now()}`;
  }
}
