# 第 3 步细化：先建数据库 → 再在 Vercel 弹窗里填环境变量

对应你项目根目录的 **`.env.example`**。本项目**没有** Stripe；剧目云上存储请用 **`SERIES_STORAGE=pg`** + **`DATABASE_URL`（或 `SUPABASE_DB_URL`）**。

更完整的 **Supabase + Cloudflare R2** 说明见 **[`docs/SUPABASE-R2.md`](./docs/SUPABASE-R2.md)**。

---

## 阶段一：准备 PostgreSQL（推荐 Supabase）

代码在 **`lib/series-repo/storage-pg.ts`** 里会在**第一次连上数据库时**自动执行 `CREATE TABLE IF NOT EXISTS` 并导入种子剧目，**你不需要自己跑迁移 SQL**。

### A. 用 Supabase 创建数据库（约 5～10 分钟）

1. 打开 [supabase.com](https://supabase.com) → 登录并 **New Project**。
2. 等待数据库就绪 → **Project Settings → Database**。
3. **Connection string** 选 **URI**，密码用项目创建时保存的 **Database password**（可在 Database 页 **Reset**）。
4. **Vercel Serverless** 建议选 **Transaction pooler**（端口 **6543**，主机名常含 `pooler.supabase.com`，参数常含 `pgbouncer=true`），有利于连接数。
5. 将**整段** `postgresql://...` 保存到本机（勿公开），下一步填到 Vercel。  
   - 变量名可用 **`DATABASE_URL`** 或 **`SUPABASE_DB_URL`**（二选一即可，见 **`lib/db/url.ts`**）。

### B. 其它托管 Postgres（可选）

若不用 Supabase，只要提供标准 **`postgresql://...`** 并配到 **`DATABASE_URL`** 或 **`PG_URL`** 即可。

---

## 阶段二：Vercel「Add Environment Variable」弹窗怎么填

在 **Settings → Environment Variables** 点 **Add Environment Variable**，会弹出你截图里的窗口。下面按**一个一个变量**说明（每个变量一般点一次 **Save**，或点 **+ Add Another** 一次加多行再统一保存——以你界面为准）。

### 弹窗里各区域含义

| 区域 | 建议 |
|------|------|
| **Key** | 环境变量**名字**，必须和下面写的**完全一致**（区分大小写）。 |
| **Value** | **只贴值**，不要加引号、不要多空格。 |
| **Environments** | **若打开 Sensitive**：只能选 **Production** 和 **Preview**，**不要**勾选 **Development**（Vercel 会提示 *Sensitive environment variables cannot be created in the Development environment*）。非敏感变量（如 `SERIES_STORAGE=pg`）可勾选含 Development 或 `All Environments`。 |
| **Branch / Select a Custom Preview Branch** | **新手不要点**。只有「某条变量只想给某一个预览分支用」时才需要；一般留空/默认即可。 |
| **Sensitive** | **密钥类**（数据库连接串、`ADMIN_KEY`、S3 Secret）建议 **打开**，保存后界面里不易再看到明文。非密钥如 `SERIES_STORAGE=pg` 可关。 |

---

### 第 1 条：`DATABASE_URL` 或 `SUPABASE_DB_URL`（必须先有阶段一里的连接串）

1. **Key** 输入：`DATABASE_URL`（不要写成 `database_url`），或 **`SUPABASE_DB_URL`**（与前者二选一）。
2. **Value**：粘贴 Supabase（或其它平台）复制的**整段** `postgresql://...`。
3. **Environments**：**只勾选 Production + Preview**（不要选 Development；不要选 All Environments，否则会含 Development）。
4. **Sensitive**：**打开**。
5. 保存。

### 第 2 条：`SERIES_STORAGE`

1. **Key**：`SERIES_STORAGE`
2. **Value**：`pg`（就两个字母，不要加引号）
3. **Environments**：可 **`All Environments`**，或 **Production + Preview + Development**（`SERIES_STORAGE` 非密钥）。
4. **Sensitive**：可关。
5. 保存。

### 第 3 条：`ADMIN_KEY`（后台 `/admin/login` 用）

1. **Key**：`ADMIN_KEY`
2. **Value**：自己定一个**长随机密码**（不要用 `admin`）。  
   - Mac 终端可生成：`openssl rand -hex 24`  
   - 把输出的一串字符整段粘贴到 Value。
3. **Environments**：**只勾选 Production + Preview**（与 `DATABASE_URL` 相同规则；Sensitive 时不能含 Development）。
4. **Sensitive**：**打开**。
5. 保存。

### 第 4～N 条：S3 兼容存储（Cloudflare R2 推荐，封面上传）

与根目录 **`.env.example`**、**`docs/SUPABASE-R2.md`** 一致，逐个添加：

- `S3_ENDPOINT`（R2：`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`）
- `S3_REGION`（R2 可用 **`auto`** 或不填）
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL`（自定义域名或公开访问前缀）

每条都是：Key = 上面名字，Value = 你 `.env.local` 里对应值，环境勾选与前面一致，**含 Secret 的项打开 Sensitive**。

---

## 阶段三：保存后必须「重新部署」

环境变量改完后，**已经部署好的那次构建不会自动带上新变量**。

1. 打开项目顶部 **Deployments**。
2. 找到最新一条 → 右侧 **⋯** → **Redeploy**（勾选 **Use existing Build Cache** 一般即可）。
3. 等变绿后，再访问站点；第一次打到读库接口时，数据库中会出现 **`series` / `episodes` 表**（自动创建）。

---

## 图 1 类问题：环境变量如何自查

在 Vercel **Settings → Environment Variables** 核对：

| 检查项 | 正确做法 |
|--------|----------|
| **Key** | 与 `.env.example` 一致：`SERIES_STORAGE`、`DATABASE_URL`（或 `SUPABASE_DB_URL` / `PG_URL`）等，无空格、大小写一致。 |
| **Value** | `SERIES_STORAGE` 仅为 **`pg`**；数据库为完整 `postgresql://...`（Supabase pooler 亦可）。 |
| **作用环境** | 至少 **Production + Preview**；若变量为 **Sensitive**，**不要**勾选 **Development**（否则会无法保存）。 |
| **是否生效** | 改完后必须 **Deployments → 对应环境最新一条 → ⋯ → Redeploy**。 |

本地对照：打开项目根目录 **`.env.local`**（勿提交），与 Vercel 中同名变量**值**应等价（本地可用 `local` 存储，线上应用 `pg`）。

---

## 阶段四：自测是否成功

1. 打开你的 **Production 或 Preview URL** + **`/admin/login`**。
2. 用你在 **`ADMIN_KEY`** 里设的那串密码登录（不是 Vercel 账号密码）。
3. 能进后台且剧目列表能加载，说明 **`DATABASE_URL` + `SERIES_STORAGE=pg`** 基本正确。

若构建或运行报错日志里有 **`Missing ... DATABASE_URL`**：说明 Vercel 里未配置 **`DATABASE_URL` / `SUPABASE_DB_URL` / `PG_URL`** 之一，或未 Redeploy。

### 提示「Sensitive … cannot be created in the Development environment」

Vercel 规定：**Sensitive 开关打开时，不能勾选 Development**。  
**处理**：在 **Environments** 里改为**只勾选 Production 与 Preview**；或关掉 **Sensitive**（不推荐用于数据库密码、ADMIN_KEY）。

### 部署状态 Error（约 30s）/ Build Failed

常见原因之一：旧版代码在构建时**静态引入** `better-sqlite3`，在 Vercel Linux 上易失败。仓库已在 `lib/series-repo/service.ts` 改为**仅当 `SERIES_STORAGE=sqlite` 时才动态加载** sqlite，并配置 `next.config.mjs` 的 `serverComponentsExternalPackages`。

若仍失败：在 Vercel 点开该条部署 → **Building** 日志，搜索 `error` / `better-sqlite3` / `DATABASE_URL`；确认 **Production / Preview** 已配置 **`SERIES_STORAGE=pg`** 与 **`DATABASE_URL`** 并已 **Redeploy**。

### 构建日志：`SyntaxError: Unexpected token 'W', "Werewolf,..." is not valid JSON`

原因：PostgreSQL **JSONB** 经 **node-pg** 读出来常常是**已解析的数组**，旧代码用 `String(tags_json)` 会变成 `Werewolf,Romance` 再 `JSON.parse` 即报错。  
处理：已改为兼容「字符串 / 数组」两种形态（见 `storage-pg.ts` 的 `tagsFromPgJsonb`）。拉最新代码后重新部署即可。

### 构建日志：`value "17..." is out of range for type integer`

原因：`created_at` 存的是 **JavaScript 毫秒时间戳**（13 位），超过 PostgreSQL **`INTEGER`（INT4）** 上限（约 21 亿）。  
处理：拉取包含 **`storage-pg.ts` 将 `created_at` 改为 `BIGINT`** 的提交；部署时会自动对**旧表**执行 `ALTER COLUMN ... BIGINT`。无需在 Supabase SQL 编辑器里手工改表（除非你选择自行执行 SQL）。

---

## 和根目录文件的对应关系

| 文件 | 作用 |
|------|------|
| **`.env.example`** | 列出所有**变量名**；Value 在 Vercel 里填，不要提交真实 `.env.local`。 |
| **`VERCEL.md`** | 分支、无持久盘、Redeploy 等总说明。 |
| **本文** | **第 3 步**：建库 + 弹窗逐项填写。 |
