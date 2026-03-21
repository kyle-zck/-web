# 技术栈：Supabase（数据库）+ Cloudflare R2（对象存储）

本项目为 **Next.js 全栈**；数据层使用 **Supabase 托管 PostgreSQL**（与旧版 Neon 独立托管等价，仅换连接方式）。媒体文件（封面等）走 **S3 兼容 API**，生产环境推荐使用 **Cloudflare R2**。

---

## 一、Supabase（替代 Neon）

### 1. 创建项目

1. 打开 [supabase.com](https://supabase.com) → 新建 **Project**。
2. 记下 **Project URL**（形如 `https://xxxx.supabase.co`），后续用于可选的 `NEXT_PUBLIC_SUPABASE_URL`。

### 2. 数据库连接串（必填：`DATABASE_URL` 或 `SUPABASE_DB_URL`）

1. **Project Settings → Database**。
2. **Connection string** 选择 **URI**。
3. **部署在 Vercel Serverless** 时建议使用 **Transaction pooler**（端口 **6543**），连接串里通常带 `pooler.supabase.com` 与 `?pgbouncer=true`，有利于连接数与冷启动。
4. 将**整段**字符串配置到环境变量：
   - **`DATABASE_URL`**（推荐），或  
   - **`SUPABASE_DB_URL`**（与 `DATABASE_URL` 二选一即可，代码会统一读取）

代码解析顺序见 **`lib/db/url.ts`**：`DATABASE_URL` → `SUPABASE_DB_URL` → `PG_URL`。

### 3. 应用层（与 Neon 的差异）

- **无需** Neon 控制台；表结构仍由 **`lib/series-repo/storage-pg.ts`** 在首次连接时 `CREATE TABLE IF NOT EXISTS` 自动创建。
- 后台账号密码哈希表 **`admin_credentials`**、剧目表 **`series` / `episodes`** 均写在**同一 Supabase PostgreSQL** 中。

### 4. 可选：Supabase JS 客户端（后续接 Auth / Dashboard）

环境变量（按需）：

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 浏览器端（anon，勿存敏感逻辑） |
| `SUPABASE_SERVICE_ROLE_KEY` | 仅服务端，**保密** |

封装见 **`lib/supabase/server.ts`**、**`lib/supabase/browser.ts`**。当前后台登录仍为本项目 **ADMIN_KEY + JWT**，与 Supabase Auth 可并存渐进迁移。

---

## 二、Cloudflare R2（视频 / 封面对象存储）

R2 提供 **S3 兼容 API**，本项目已用 **`@aws-sdk/client-s3`**，无需改业务代码，只需环境变量。

### 1. 创建 R2 桶与凭证

1. Cloudflare Dashboard → **R2** → **Create bucket**。
2. **Manage R2 API Tokens** → 创建 **API Token**（读写该桶），得到 **Access Key ID** 与 **Secret Access Key**。
3. **Account ID** 在 R2 概览页可见；S3 API 端点为：

   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

### 2. 环境变量（与 `.env.example` 一致）

| 变量 | 示例 / 说明 |
|------|-------------|
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_REGION` | `auto`（可不设，代码在检测到 R2 域名时会默认 `auto`） |
| `S3_BUCKET` | 桶名称 |
| `S3_ACCESS_KEY_ID` | R2 API Token 的 Access Key |
| `S3_SECRET_ACCESS_KEY` | R2 API Token 的 Secret |
| `S3_PUBLIC_BASE_URL` | 对外访问 URL 前缀：自定义域名 `https://cdn.example.com` 或 R2 **Public bucket** 提供的公开 URL（勿以裸 `r2` 内网地址给浏览器用，除非已配置公开访问） |

### 3. 上传行为

- **`app/admin/api/upload/cover/route.ts`**：上传封面到 `covers/...`。
- 未配置 R2/S3 时，本地开发仍回退到 **`public/uploads/covers`**。

---

## 三、Vercel 环境变量清单（摘要）

| 变量 | 说明 |
|------|------|
| `SERIES_STORAGE` | `pg` |
| `DATABASE_URL` 或 `SUPABASE_DB_URL` | Supabase Postgres URI |
| `ADMIN_KEY` | 后台首次登录密码（建议改密后存库） |
| `S3_*` | 配置 R2 后填齐上述 6 项 |

详细逐步操作仍以根目录 **`VERCEL-STEP3-ENV-AND-DB.md`** 为准（已改为 Supabase 为主）。
