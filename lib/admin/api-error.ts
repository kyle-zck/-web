import type { TFunction } from "i18next";

/** 将后台 API 返回的 errorKey / error 转为界面文案（随 i18n 语言切换） */
export function translateAdminApiError(
  json: { error?: string; errorKey?: string } | null | undefined,
  t: TFunction,
  fallbackKey = "submitFailed"
): string {
  // Normalize key: support both "admin.submitFailed" (full path) and "submitFailed" (short key).
  const fullKey = (k: string) =>
    k.startsWith("common.admin.") ? k : `common.admin.${k}`;

  if (!json) return String(t(fullKey(fallbackKey)));

  if (typeof json.errorKey === "string" && json.errorKey.length > 0) {
    const translated = t(fullKey(json.errorKey));
    // If i18next couldn't find the key it returns the raw key; in that case use error if available.
    if (!translated.startsWith("common.admin.")) return translated;
    if (json.error) return json.error;
    return String(t(fullKey(fallbackKey)));
  }

  if (json.error) return json.error;
  return String(t(fullKey(fallbackKey)));
}
