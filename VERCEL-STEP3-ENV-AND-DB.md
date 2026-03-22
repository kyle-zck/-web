# 第 3 步细化：先建数据库 → 再在 Vercel 弹窗里填环境变量

对应你项目根目录的 **`.env.example`**。本项目**没有** Stripe；剧目云上存储请用 **`SERIES_STORAGE=pg`** + **`DATABASE_URL`（或 `SUPABASE_DB_URL`）**。

更完整的 **Supabase + Cloudflare R2** 说明见 **[`docs/SUPABASE-R2.md`](./docs/SUPABASE-R2.md)**。

**封面用 HTTPS（勿存 Base64）+ 前台 API 缓存调优**：见 **[`docs/COVER-CDN-AND-API-CACHE.md`](./docs/COVER-CDN-AND-API-CACHE.md)**。

---

## 阶段一：准备 PostgreSQL（推荐 Supabase）

代码在 **`lib/series-repo/storage-pg.ts`** 里会在**第一次连上数据库时**自动执行 `CREATE TABLE IF NOT EXISTS` 并导入种子剧目，**你不需要自己跑迁移 SQL**。

### A. 用 Supabase 创建数据库（约 5～10 分钟）

下面按「你第一次操作」来写，可从上到下照着点。

#### A1. 注册 / 登录

1. 浏览器打开 **[https://supabase.com](https://supabase.com)**。
2. 右上角 **Sign in**（已有账号）或 **Start your project**（新用户按提示注册，可用 GitHub / Google 等）。
3. 登录后进入 **Dashboard**（项目列表页）。

#### A2. 新建项目（New Project）

1. 点绿色按钮 **New project**（或 **New Project**）。
2. 若提示选 **Organization**：选个人组织或新建一个即可。
3. 填写表单（常见几项）：
   - **Name**：任意英文名，例如 `reelshorts-prod`（仅作标识）。
   - **Database Password**：**务必自己设一个强密码并立刻复制保存到密码管理器/备忘录**（后面连接串里要用；丢了只能 Reset）。
   - **Region**：选离用户或 Vercel 区域较近的（如 **Southeast Asia (Singapore)**）。
4. 点 **Create new project**，等待 **1～3 分钟**（界面会显示 *Setting up project* / *Provisioning*），**不要关页**，直到出现表编辑器或主控制台。

#### A3. 打开「数据库连接串」页面（侧栏没有 Database 时请看方式一、二）

新版 Supabase 控制台里，**不一定**在 **Settings** 左侧显示 **Database** 这一项；连接串常在顶部 **Connect** 里，或用下面**直达链接**打开。

**方式一（推荐）：项目顶部的 Connect**

1. 点左侧 **Home**（房子图标）回到**项目概览**，不要停在 *General* 设置页。
2. 看页面**上方**是否有 **Connect**（连接）按钮 → 点击。
3. 在弹窗/抽屉里选 **Connection String** / **ORMs** / **App Frameworks** 等任意入口，直到出现 **Postgres** 连接信息。
4. 在连接类型里选 **Transaction pooler**（或 **Transaction**），再按 **A4** 核对端口 **6543** 与 `pooler`。

**方式二：用浏览器直达 Database 设置页（侧栏找不到时最省事）**

1. 打开 **Project Settings → General**，记下 **Project ID**（一串字母数字，例如 `iqastxkcyfrwaimqczrj`）。
2. 在浏览器地址栏输入（把末尾的 `你的PROJECT_REF` 换成上一步的 Project ID）：

   `https://supabase.com/dashboard/project/你的PROJECT_REF/settings/database`

3. 进入后向下滚动，找到 **Connection string** 区域 → 再按 **A4、A5** 复制 URI、替换密码。

**方式三：从 Settings 侧栏进入**

1. 左下角 **齿轮 Project Settings**。
2. 左侧 **CONFIGURATION** 分组里找 **Database**（有时需要**向下滚动**侧栏才出现）。
3. 若始终没有 **Database**：请改用 **方式一** 或 **方式二**（界面因账号/版本会略有差异，属正常情况）。

#### A4. 选对「连接方式」（给 Vercel 用：务必用 Pooler）

Supabase 会提供多种 Tab，**部署到 Vercel Serverless 时请用「连接池」**，否则容易连接数爆满或冷启动连不上。

1. 在 **Connection string** 里先选 **URI**（不是仅 JDBC 等其它格式）。
2. 再在同一区域找 **Method / Type** 一类选项，选中 **Transaction** 或 **Transaction pooler**（名称以你控制台为准）。
3. 核对特征（满足即可）：
   - 端口是 **`6543`**（不是 `5432`）。
   - 主机名里通常有 **`pooler.supabase.com`**。
   - 连接串查询参数里常有 **`pgbouncer=true`**。

> **不要**把「Direct connection / Session mode / 5432 直连」那条直接贴到 Vercel，除非你非常清楚自己在做长连接；本项目文档默认 **Pooler + 6543**。

#### A5. 复制连接串并替换密码占位符

1. 点连接串旁的 **Copy**（复制）。
2. 复制出来的字符串形如：  
   `postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-xxx.pooler.supabase.com:6543/postgres?pgbouncer=true`  
   （具体主机名以你项目为准。）
3. 把其中的 **`[YOUR-PASSWORD]`**（或 `YOUR_PASSWORD`）**整段替换成你在 A2 里保存的「数据库密码」**；若密码里有特殊字符，Supabase 有时会给出「已 URL 编码」的说明，以控制台提示为准。
4. 最终应得到**一整行**、以 `postgresql://` 开头、**无多余换行、无首尾空格** 的 URI。

#### A6. 先放本地再填 Vercel（推荐顺序）

1. 在项目根目录复制 **`.env.example`** 为 **`.env.local`**（若已有则编辑它）。
2. 新增一行（二选一变量名即可，不要两行同时填不同库）：
   - `DATABASE_URL=postgresql://...`  
   或  
   - `SUPABASE_DB_URL=postgresql://...`  
3. 保存后本地可 `npm run dev` 试连；**不要把 `.env.local` 提交到 Git**。
4. 部署到 Vercel 时：在 **Settings → Environment Variables** 里添加**同名**变量，**Value 贴同一整段 URI**（见下文「阶段二 第 1 条」）。

代码读取顺序见 **`lib/db/url.ts`**：`DATABASE_URL` → `SUPABASE_DB_URL` → `PG_URL`。

#### A7. 忘记数据库密码怎么办

1. 打开 **Settings → Database**；若侧栏没有该项，使用与 **A3 方式二** 相同的直达地址：  
   `https://supabase.com/dashboard/project/你的PROJECT_REF/settings/database`
2. 找到 **Database password** 区域 → **Reset database password**。
3. 设新密码并保存 → **必须重新复制 Connection string 并按 A5 再拼一次 URI**（旧连接串里的密码失效）。

---

### A′. 前台用户登录（Supabase Auth）还要配这些

若你要用网站上的**邮箱/社交登录**（不是后台 `/admin`），除了上面的**数据库 URL**，还需要在 Supabase 取 **Project URL** 和 **anon key**，并配回调地址。

#### A′1. 取 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**在网页里配置（不是在你电脑项目里改代码）：**

1. 打开 [Supabase Dashboard](https://supabase.com/dashboard) → 点进你的项目。
2. 左下角 **齿轮 Project Settings** → 左侧点 **API Keys**（新版）；若界面仍是旧版，则点 **API**。
3. **Project URL**（形如 `https://xxxx.supabase.co`）→ 填到 **`.env.local` / Vercel** 的 **`NEXT_PUBLIC_SUPABASE_URL`**。
4. **Legacy API keys**（或 **anon public**）→ 复制长串 → 填到 **`NEXT_PUBLIC_SUPABASE_ANON_KEY`**。  
   - 直达（把 `你的PROJECT_REF` 换成 Settings → General 里的 Project ID）：  
     `https://supabase.com/dashboard/project/你的PROJECT_REF/settings/api-keys`

#### A′2. 控制台里配「登录成功跳回哪里」

**也在 Supabase 网页里配，路径是左侧主菜单的「Authentication」，不是 Project Settings。**

1. 左侧点 **Authentication**（锁形图标，与 Table Editor、SQL 等并列）。
2. 在 Authentication 下找 **URL Configuration**（或 **Redirect URLs**）：
   - **Site URL**：填你网站根地址，例如 `https://xxx.vercel.app` 或自定义域名。
   - **Redirect URLs**：**逐行**添加（每行一条）：
     - `http://localhost:3000/auth/callback`
     - `https://你的线上域名/auth/callback`
3. 仍在 **Authentication** 下打开 **Sign In Methods** / **Providers**（名称因版本略有不同）：
   - 打开 **Email**；要用 Google 等再逐个启用并填 Client ID / Secret。

**直达（替换 `你的PROJECT_REF`）：**

- URL 配置：  
  `https://supabase.com/dashboard/project/你的PROJECT_REF/auth/url-configuration`
- 登录方式 / Provider：  
  `https://supabase.com/dashboard/project/你的PROJECT_REF/auth/providers`

**若当前还不是最终域名（例如先用 Vercel 默认 `*.vercel.app`，以后要换自定义域名）：**

| 项 | 怎么填 |
|----|--------|
| **Site URL** | 先填你**现在真实在用的**站点根地址即可（例如 `https://项目名.vercel.app`）。上线换正式域名后，再来这里改成最终域名。 |
| **Redirect URLs** | 可**同时写多条**（每行一个），不必只留一个。建议至少：`http://localhost:3000/auth/callback` + **当前**线上地址的 `/auth/callback`。以后有预览域名、正式域名，**逐条追加**新的 `https://xxx/auth/callback`，保存即可；旧的预览地址可保留或删掉。 |
| **环境变量** | Vercel 里 `NEXT_PUBLIC_SUPABASE_*` 与 **Site URL / Redirect** 无自动联动；换域名后记得在 Supabase 里更新 URL，并在 Vercel **Redeploy**（若前端硬编码了域名则改代码，本项目回调用相对路径 `/auth/callback`，一般只需改 Supabase 控制台）。 |

#### A′3. 与本项目代码的对应关系

- 浏览器会话、登录弹窗：**`components/supabase/SupabaseProvider.tsx`**、**`components/ui/auth-modal.tsx`**。
- OAuth / 邮箱确认回调：**`/auth/callback`** → **`app/auth/callback/route.ts`**。
- 更完整说明见 **`docs/SUPABASE-R2.md`** 第四节。

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

### 构建日志：`password authentication failed for user "postgres"`

含义：Vercel 使用的 **`DATABASE_URL`（或 `SUPABASE_DB_URL`）里密码不对**，或整段 URI 在粘贴时被破坏（多空格、少了字符、多了引号）。

**请逐项检查：**

1. **与 Supabase 一致**：到 **Connect → Transaction pooler → URI**，复制后把 **`[YOUR-PASSWORD]`** 换成**当前**「数据库密码」（建项目时设的；若改过密码，必须用新密码）。
2. **Vercel 里 Value**：**不要**加英文双引号 `""` 包裹整串；**不要**首尾空格；整段应一行 `postgresql://...`。
3. **密码含特殊字符**（如 `@ # : / ? * %`）：应用 Supabase 控制台「一键复制」的串；若手拼 URI，需对密码做 **URL 编码**（否则 `@` 后面的内容会被当成主机名）。
4. **用户名**：连接池串里用户名多为 **`postgres.你的ProjectRef`**，不要用错成单独的 `postgres`（除非控制台明确给出直连串且你清楚用途）。
5. 改完变量后务必 **Redeploy**。  
   说明：仓库已对 **`/api/series` 等读库 Route** 设置 **`dynamic = "force-dynamic"`**，减少「构建阶段就连库」导致的失败；但**线上访问仍需要正确的 `DATABASE_URL`**，否则页面运行时仍会报错。

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
