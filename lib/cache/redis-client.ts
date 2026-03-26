import Redis from "ioredis";

type GlobalRedis = typeof globalThis & { __shortDramaRedis?: Redis };

function redisUrl(): string | undefined {
  const u = process.env.REDIS_URL?.trim();
  return u || undefined;
}

/**
 * 可选 Redis：多实例 / Serverless 下共享互动计数等读穿缓存。
 * 未配置 REDIS_URL 时返回 null，逻辑回退到 Next Data Cache。
 */
export function getRedis(): Redis | null {
  const url = redisUrl();
  if (!url) return null;

  const g = globalThis as GlobalRedis;
  if (!g.__shortDramaRedis) {
    g.__shortDramaRedis = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true
    });
  }
  return g.__shortDramaRedis;
}

export function isRedisConfigured(): boolean {
  return Boolean(redisUrl());
}
