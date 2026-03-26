import type { EngagementCounts } from "@/lib/user-repo/types";
import { getRedis } from "./redis-client";

const PREFIX = "shortdrama:eng:v1:";

function redisKey(seriesId: string): string {
  return `${PREFIX}${seriesId}`;
}

function parseRedisEngagementTtlSec(): number {
  const raw = process.env.REDIS_ENGAGEMENT_TTL_SEC;
  if (raw == null || raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export async function redisEngagementMGet(seriesIds: string[]): Promise<{
  hits: Record<string, EngagementCounts>;
  misses: string[];
}> {
  const hits: Record<string, EngagementCounts> = {};
  const redis = getRedis();
  if (!redis || seriesIds.length === 0) {
    return { hits, misses: [...seriesIds] };
  }

  try {
    const keys = seriesIds.map(redisKey);
    const values = await redis.mget(...keys);
    const misses: string[] = [];
    seriesIds.forEach((id, i) => {
      const raw = values[i];
      if (raw == null || raw === "") {
        misses.push(id);
        return;
      }
      try {
        const parsed = JSON.parse(raw) as EngagementCounts;
        if (
          typeof parsed.collectionCount === "number" &&
          typeof parsed.likesCount === "number" &&
          typeof parsed.viewsCount === "number"
        ) {
          hits[id] = parsed;
        } else {
          misses.push(id);
        }
      } catch {
        misses.push(id);
      }
    });
    return { hits, misses };
  } catch {
    return { hits: {}, misses: [...seriesIds] };
  }
}

export async function redisEngagementMSet(entries: Record<string, EngagementCounts>): Promise<void> {
  const redis = getRedis();
  if (!redis || Object.keys(entries).length === 0) return;

  const ttl = parseRedisEngagementTtlSec();
  try {
    const pipe = redis.pipeline();
    for (const [id, counts] of Object.entries(entries)) {
      const payload = JSON.stringify(counts);
      if (ttl > 0) {
        pipe.set(redisKey(id), payload, "EX", ttl);
      } else {
        pipe.set(redisKey(id), payload);
      }
    }
    await pipe.exec();
  } catch {
    // 缓存失败不阻断主流程
  }
}

export async function redisEngagementDel(seriesIds: string[]): Promise<void> {
  const redis = getRedis();
  if (!redis || seriesIds.length === 0) return;
  try {
    await redis.del(...seriesIds.map(redisKey));
  } catch {
    // ignore
  }
}
