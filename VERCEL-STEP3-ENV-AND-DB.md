# 第 3 步细化：先建数据库 → 再在 Vercel 弹窗里填环境变量

对应你项目根目录的 **`.env.example`**。本项目**没有** Stripe；剧目云上存储请用 **`SERIES_STORAGE=pg` + `DATABASE_URL`**。

---

## 阶段一：准备 PostgreSQL（你还没有数据库时）

代码在 **`lib/series-repo/storage-pg.ts`** 里会在**第一次连上数据库时**自动执行 `CREATE TABLE IF NOT EXISTS` 并导入种子剧目，**你不需要自己跑迁移 SQL**。

下面用 **Neon**（免费额度、和 Vercel 搭配多）举例；**Supabase / Railway / Vercel Marketplace 里的 Postgres** 同理，只要最后拿到 **`postgresql://...` 连接串**即可。

### A. 用 Neon 创建数据库（约 5～10 分钟）

1. 浏览器打开 **https://neon.tech** → **Sign up**（可用 GitHub 登录）。
2. **Create a project**（新建项目）。
   - **Region**：尽量选离你 Vercel 区域近的（例如美东 `AWS US East`）。
   - Postgres 版本默认即可。
3. 创建完成后，进入项目控制台，找到 **Connection string** / **连接字符串**。
4. 复制 **URI** 形式，一般长这样：  
   `postgresql://用户名:密码@xxx.neon.tech/数据库名?sslmode=require`  
   - 若同时有 **Pooled**（连接池）和 **Direct**：部署在 Vercel Serverless 时**优先选 Pooled**（若无 Pooled，用默认 URI 通常也可以）。
5. **先保存到本机记事本**（勿发到公开地方），下一步填到 Vercel 的 **Value** 里。

### B. 其它平台（可选）

| 平台 | 你要做的事 |
|------|------------|
| **Supabase** | Project → **Settings → Database** → **Connection string** → URI，复制。 |
| **Vercel Storage** | 若你在 Vercel 里创建了 Postgres，看 **Storage** 或集成说明里给出的连接串；若变量名是 `POSTGRES_URL` 等，而本项目只认 **`DATABASE_URL` 或 `PG_URL`**，请在 Vercel **再手动加一条** `DATABASE_URL`，**值填同一条连接串**。 |

---

## 阶段二：Vercel「Add Environment Variable」弹窗怎么填

在 **Settings → Environment Variables** 点 **Add Environment Variable**，会弹出你截图里的窗口。下面按**一个一个变量**说明（每个变量一般点一次 **Save**，或点 **+ Add Another** 一次加多行再统一保存——以你界面为准）。

### 弹窗里各区域含义

| 区域 | 建议 |
|------|------|
| **Key** | 环境变量**名字**，必须和下面写的**完全一致**（区分大小写）。 |
| **Value** | **只贴值**，不要加引号、不要多空格。 |
| **Environments** | 选 **`All Environments`** 最简单：Production + Preview + Development 都能用；若只想生产与预览，可改为只勾选 **Production** 和 **Preview**。 |
| **Branch / Select a Custom Preview Branch** | **新手不要点**。只有「某条变量只想给某一个预览分支用」时才需要；一般留空/默认即可。 |
| **Sensitive** | **密钥类**（数据库连接串、`ADMIN_KEY`、S3 Secret）建议 **打开**，保存后界面里不易再看到明文。非密钥如 `SERIES_STORAGE=pg` 可关。 |

---

### 第 1 条：`DATABASE_URL`（必须先有阶段一里的连接串）

1. **Key** 输入：`DATABASE_URL`（不要写成 `database_url`）。
2. **Value**：粘贴 Neon（或其它平台）复制的**整段** `postgresql://...`。
3. **Environments**：`All Environments`（或至少 **Production + Preview**）。
4. **Sensitive**：**打开**。
5. 保存。

### 第 2 条：`SERIES_STORAGE`

1. **Key**：`SERIES_STORAGE`
2. **Value**：`pg`（就两个字母，不要加引号）
3. **Environments**：与上一条一致（建议 `All Environments`）。
4. **Sensitive**：可关。
5. 保存。

### 第 3 条：`ADMIN_KEY`（后台 `/admin/login` 用）

1. **Key**：`ADMIN_KEY`
2. **Value**：自己定一个**长随机密码**（不要用 `admin`）。  
   - Mac 终端可生成：`openssl rand -hex 24`  
   - 把输出的一串字符整段粘贴到 Value。
3. **Environments**：同上。
4. **Sensitive**：**打开**。
5. 保存。

### 第 4～N 条：S3（只有你在本机 `.env.local` 里配了封面上传时才加）

与根目录 **`.env.example`** 一致，逐个添加：

- `S3_ENDPOINT`
- `S3_REGION`（例如 `us-east-1`）
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL`

每条都是：Key = 上面名字，Value = 你 `.env.local` 里对应值，环境勾选与前面一致，**含 Secret 的项打开 Sensitive**。

---

## 阶段三：保存后必须「重新部署」

环境变量改完后，**已经部署好的那次构建不会自动带上新变量**。

1. 打开项目顶部 **Deployments**。
2. 找到最新一条 → 右侧 **⋯** → **Redeploy**（勾选 **Use existing Build Cache** 一般即可）。
3. 等变绿后，再访问站点；第一次打到读库接口时，Neon 里会出现 **`series` / `episodes` 表**（自动创建）。

---

## 阶段四：自测是否成功

1. 打开你的 **Production 或 Preview URL** + **`/admin/login`**。
2. 用你在 **`ADMIN_KEY`** 里设的那串密码登录（不是 Vercel 账号密码）。
3. 能进后台且剧目列表能加载，说明 **`DATABASE_URL` + `SERIES_STORAGE=pg`** 基本正确。

若构建或运行报错日志里有 **`Missing PG_URL/DATABASE_URL`**：说明 Vercel 里变量名写错或未 Redeploy。

---

## 和根目录文件的对应关系

| 文件 | 作用 |
|------|------|
| **`.env.example`** | 列出所有**变量名**；Value 在 Vercel 里填，不要提交真实 `.env.local`。 |
| **`VERCEL.md`** | 分支、无持久盘、Redeploy 等总说明。 |
| **本文** | **第 3 步**：建库 + 弹窗逐项填写。 |
