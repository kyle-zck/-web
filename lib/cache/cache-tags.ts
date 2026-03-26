/** Next.js Data Cache `tags` 与 revalidateTag 共用字符串，勿随意改名 */

export const PUBLIC_LISTED_SERIES_TAG = "public-listed-series";

export function engagementSeriesTag(seriesId: string): string {
  return `engagement-series-${seriesId}`;
}

export function seriesDetailTag(seriesId: string): string {
  return `series-detail-${seriesId}`;
}
