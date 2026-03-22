import { readCatalog } from "./store";

/** 新建/更新剧目时：若「管理标签」目录非空，则 tags 必须全部来自目录中的名称 */
export async function validateTagsAgainstCatalog(
  tags: string[]
): Promise<{ ok: true } | { ok: false; invalid: string[] }> {
  const { items } = await readCatalog();
  if (items.length === 0) return { ok: true };
  const allowed = new Set(items.map((i) => i.name.trim()));
  const normalized = tags.map((t) => t.trim()).filter(Boolean);
  const invalid = normalized.filter((t) => !allowed.has(t));
  if (invalid.length) return { ok: false, invalid };
  return { ok: true };
}
