import fs from "fs";
import path from "path";

const REG_PATH = path.join(process.cwd(), "data", "drama-id-registry.json");

type RegistryFile = {
  /** 下一部新剧可用的 ID（若 byTitle 已占用更大值，仍以 nextId 为准递增） */
  nextId: number;
  /** 规范化剧名 → 剧 ID（同一剧名始终同一 ID，便于删剧后重传仍可对上） */
  byTitle: Record<string, number>;
};

function ensureDir() {
  const dir = path.dirname(REG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** 与后台「剧目名称」筛选一致：去首尾空白、合并空格、小写 */
export function normalizeDramaTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * 按「剧名」唯一分配 dramaId：从 10000 起递增；同一规范化剧名永远得到同一 ID。
 */
export function assignDramaIdForTitle(title: string): number {
  const key = normalizeDramaTitle(title);
  if (!key) return 10000;

  ensureDir();
  let reg: RegistryFile = { nextId: 10000, byTitle: {} };
  try {
    if (fs.existsSync(REG_PATH)) {
      const raw = fs.readFileSync(REG_PATH, "utf-8");
      reg = { ...reg, ...JSON.parse(raw) } as RegistryFile;
      if (!reg.byTitle || typeof reg.byTitle !== "object") reg.byTitle = {};
      if (typeof reg.nextId !== "number" || reg.nextId < 10000) reg.nextId = 10000;
    }
  } catch {
    reg = { nextId: 10000, byTitle: {} };
  }

  const existing = reg.byTitle[key];
  if (existing != null && existing >= 10000) {
    fs.writeFileSync(REG_PATH, JSON.stringify(reg, null, 2), "utf-8");
    return existing;
  }

  const next = Math.max(reg.nextId, 10000);
  reg.byTitle[key] = next;
  reg.nextId = next + 1;
  fs.writeFileSync(REG_PATH, JSON.stringify(reg, null, 2), "utf-8");
  return next;
}
