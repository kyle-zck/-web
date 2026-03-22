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
- **站点配置**（品牌名、SEO、导航、首页模块、法务链接、订阅套餐等）在 **`SERIES_STORAGE=pg`** 且已配置数据库 URL 时写入表 **`site_config_snapshot`**（单条 JSONB），实现见 **`lib/app-config/storage-pg.ts`**；本地开发或未启用 PG 时仍用 **`data/app-config.json`**。`next build` 阶段默认不连远程 PG 读站点配置，避免静态生成超时（见 **`NEXT_SKIP_APP_CONFIG_PG`** / `npm_lifecycle_event`）。

#### 用户侧数据（UID、充值、观看、收藏、点赞）

- **`SERIES_STORAGE=pg`** 且已配置 **`DATABASE_URL` / `SUPABASE_DB_URL`** 时：前台 **`/api/user/*`** 与后台管理里用户相关接口走 **PostgreSQL**，实现见 **`lib/user-repo/storage-pg.ts`**（首次连接时自动建表）。
- 表名概览：**`app_user_profiles`**（`clientId` ↔ 展示用 `uid`）、**`recharge_records`**、**`watch_history_entries`**、**`user_favorites`**、**`user_likes`**。
- 若 `SERIES_STORAGE=local` 或未配置数据库 URL：仍使用项目根目录 **`data/*.json`**（仅适合本机；**Vercel 上请用 `pg`**）。

### 4. 前台 Supabase Auth（邮箱密码 + OAuth）

环境变量（前台登录**必填**）：

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 浏览器端（anon，勿存敏感逻辑） |
| `SUPABASE_SERVICE_ROLE_KEY` | 仅服务端，**保密**（可选，用于 Admin API 等） |

代码入口：

- **`lib/supabase/browser.ts`**：`createBrowserClient`（`@supabase/ssr`），Cookie 会话。
- **`middleware.ts`**：非 `/admin` 路由刷新 Supabase 会话；**`/admin`** 仍走 **ADMIN_KEY + JWT**，与前台 Cookie **隔离**。
- **`components/supabase/SupabaseProvider.tsx`**：监听 `onAuthStateChange`，同步到 Zustand `useUserStore`。
- **`app/auth/callback/route.ts`**：OAuth / 邮箱确认链接回调（`code` → `exchangeCodeForSession`）。

**Supabase 控制台**：Authentication → **URL Configuration** 中把 **Site URL** 设为生产域名（如 `https://你的域名`），**Redirect URLs** 增加：

- `http://localhost:3000/auth/callback`（本地）
- `https://你的域名/auth/callback`（生产）

并在 **Providers** 中启用 Email（及可选 Google / Apple 等）。OAuth 需在对应 Provider 控制台配置 Client ID/Secret。

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

**生产封面 URL、避免 Base64、以及加大 `/api/series` 缓存**：见 **[`COVER-CDN-AND-API-CACHE.md`](./COVER-CDN-AND-API-CACHE.md)**。

---

## 三、Vercel 环境变量清单（摘要）

| 变量 | 说明 |
|------|------|
| `SERIES_STORAGE` | `pg` |
| `DATABASE_URL` 或 `SUPABASE_DB_URL` | Supabase Postgres URI |
| `ADMIN_KEY` | 后台首次登录密码（建议改密后存库） |
| `S3_*` | 配置 R2 后填齐上述 6 项 |

详细逐步操作仍以根目录 **`VERCEL-STEP3-ENV-AND-DB.md`** 为准（已改为 Supabase 为主）。
