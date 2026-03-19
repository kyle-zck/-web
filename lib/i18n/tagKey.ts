import type { CategoryTag } from "@/constants/mock-data";

export function getTagKey(tag: CategoryTag) {
  if (tag === "Time Travel") return "timeTravel";
  return tag;
}

