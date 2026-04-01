import type { TFunction } from "i18next";

/** 将后台 API 返回的 errorKey / error 转为界面文案（随 i18n 语言切换） */
export function translateAdminApiError(
  json: { error?: string; errorKey?: string } | null | undefined,
  t: TFunction,
  fallbackKey = "common.admin.submitFailed"
): string {
  if (!json) return String(t(fallbackKey));
  if (typeof json.errorKey === "string" && json.errorKey.length > 0) {
    return String(t(`common.admin.${json.errorKey}`));
  }
  if (json.error) return json.error;
  return String(t(fallbackKey));
}
