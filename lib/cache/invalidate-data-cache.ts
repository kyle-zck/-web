import { revalidateTag } from "next/cache";
import {
  engagementSeriesTag,
  PUBLIC_LISTED_SERIES_TAG,
  seriesDetailTag
} from "./cache-tags";
import { redisEngagementDel } from "./engagement-distributed-cache";

/** 收藏/点赞/观看等变更后：失效 Next 中带 `engagement-series-*` 标签的 Data Cache，并删 Redis 分剧 key */
export async function invalidateEngagementEverywhere(seriesIds: string[]): Promise<void> {
  const unique = [...new Set(seriesIds.filter((id) => typeof id === "string" && id.length > 0))];
  for (const id of unique) {
    revalidateTag(engagementSeriesTag(id));
  }
  await redisEngagementDel(unique);
}

/** 剧目详情页 unstable_cache */
export function revalidateSeriesDetail(seriesId: string): void {
  if (!seriesId) return;
  revalidateTag(seriesDetailTag(seriesId));
}

/** 前台 /api/series 列表缓存 */
export function revalidatePublicSeriesList(): void {
  revalidateTag(PUBLIC_LISTED_SERIES_TAG);
}

/** 改剧、删剧、增删集等：列表 + 该剧详情一并失效 */
export function invalidateSeriesCatalogCaches(seriesId: string): void {
  revalidatePublicSeriesList();
  revalidateSeriesDetail(seriesId);
}
