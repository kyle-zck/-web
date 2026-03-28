/**
 * 管理端可编辑列表的稳定 React key：勿用会随输入变化的业务 id 作为 key。
 * 该字段仅存在于前端 state，提交 API 前需 strip。
 */
export const CLIENT_ROW_KEY = "__clientRowKey" as const;

export type WithClientRowKey<T extends object> = T & { [CLIENT_ROW_KEY]: string };

export function newClientRowKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** 为每条行数据分配稳定 key（已存在则保留，便于未来做持久化扩展） */
export function assignClientRowKeys<T extends object>(rows: T[]): WithClientRowKey<T>[] {
  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    const k = r[CLIENT_ROW_KEY];
    if (typeof k === "string" && k.length > 0) {
      return { ...row, [CLIENT_ROW_KEY]: k } as WithClientRowKey<T>;
    }
    return { ...row, [CLIENT_ROW_KEY]: newClientRowKey() } as WithClientRowKey<T>;
  });
}

export function stripClientRowKey<T extends object>(row: T): T {
  const { [CLIENT_ROW_KEY]: _, ...rest } = row as T & Record<string, unknown>;
  return rest as T;
}
