function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 深度合并；数组与 null 以右侧为准整体替换 */
export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  patch: Partial<T> | Record<string, unknown>
): T {
  const out = { ...base } as T;
  for (const key of Object.keys(patch)) {
    const pk = key as keyof T;
    const bv = (patch as Record<string, unknown>)[key];
    if (bv === undefined) continue;
    const av = base[pk] as unknown;
    if (Array.isArray(bv)) {
      (out as Record<string, unknown>)[key] = bv;
      continue;
    }
    if (bv === null) {
      (out as Record<string, unknown>)[key] = null;
      continue;
    }
    if (isPlainObject(av) && isPlainObject(bv)) {
      (out as Record<string, unknown>)[key] = deepMerge(
        av as Record<string, unknown>,
        bv as Record<string, unknown>
      );
      continue;
    }
    (out as Record<string, unknown>)[key] = bv;
  }
  return out;
}
