# 剧目存储自检（与你当前环境对应）

## 你当前配置（`.env.local`）

- **`SERIES_STORAGE=pg`** → 剧目存在 **PostgreSQL**（通常为 Supabase）。
- 迁移逻辑在 **`lib/series-repo/storage-pg.ts`** 的 `initIfNeeded()`：首次连库时会 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 并补全 `drama_id` 等字段。

## 一键检查（推荐）

在项目根目录执行（需 **Node 20+**，以加载 `.env.local`）：

```bash
npm run check:series-pg
```

- 会列出 `series` / `episodes` 是否包含：`drama_id`、`original_name`、`completed_at` 等列。
- 并打印最近 3 条剧目样例行，确认 **`drama_id`、`original_name`、`created_at`** 是否有值。

若提示缺列：先 **`npm run dev`** 访问一次前台或后台（触发连库与迁移），再重跑 `npm run check:series-pg`。

## 在 Supabase 里手动看（可选）

SQL Editor 执行：

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'series'
ORDER BY ordinal_position;
```

## 其他模式

| `SERIES_STORAGE` | 数据位置 |
|------------------|----------|
| `local`（默认） | `data/series-store.json` + `data/drama-id-registry.json` |
| `sqlite` | `data/series.sqlite` |
| `pg` | Supabase / Postgres 表 `series`、`episodes` |
