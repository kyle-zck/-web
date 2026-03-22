import type { TFunction } from "i18next";

/** 将标签名映射到 i18n 键（内置分类仍用原名；Time Travel 特殊） */
export function getTagKey(tag: string): string {
  if (tag === "Time Travel") return "timeTravel";
  return tag;
}

/** 展示标签：优先用 i18n，若无翻译则显示原文（与「管理标签」目录一致） */
export function tagLabel(tag: string, t: TFunction): string {
  const key = getTagKey(tag);
  return t(`tags.${key}`, { defaultValue: tag });
}
