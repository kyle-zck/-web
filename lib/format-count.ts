/** 点赞/收藏/观看等展示：0、1.2k、13.1M */
export function formatEngagementCount(n: number): string {
  const val = Math.max(0, Math.floor(n));
  if (val === 0) return "0";
  if (val < 1000) return String(val);
  if (val < 1_000_000) return `${(val / 1000).toFixed(1)}k`;
  return `${(val / 1_000_000).toFixed(1)}M`;
}
