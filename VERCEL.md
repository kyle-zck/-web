# Vercel 部署操作指南（细化版）

> 与 `.env.example`、`DEPLOY.md` 一起使用。以下为在 **Vercel 网页控制台** 中的点击路径与注意事项。

---

## 你需要在 Vercel 上亲自做的 3 件事（总览）

| # | 做什么 | 去哪里 |
|---|--------|--------|
| ① | 已连接 GitHub 仓库可跳过；否则 **Import** 项目 | Dashboard → **Add New → Project** |
| ② | **Production 分支 = `main`** | **Settings → Git**（页面中向下滚动找「生产分支」相关项） |
| ③ | 配置 **环境变量**（线上至少 `SERIES_STORAGE=pg` + `DATABASE_URL`） | **Settings → Environment Variables** |

日常开发：**推 `dev`** → 自动生成 **Preview**；**合并进 `main`** → 更新 **Production**。

---

## ① 连接 GitHub 仓库（Import）

**若已显示 Connected Repository（例如 `kyle-zck/-web`），可跳过本节。**

1. 打开 [vercel.com](https://vercel.com) 并登录（建议 **Continue with GitHub**）。
2. 右上角 **Add New…** → **Project**。
3. **Import Git Repository** 里找到 **`kyle-zck/-web`**（或你的仓库）→ **Import**。
4. **Configure Project**：
   - **Framework Preset**：`Next.js`（一般自动识别）。
   - **Root Directory**：`.`（默认即可）。
   - **Build Command**：`npm run build`（默认即可）。
   - **Output Directory**：Next 默认由框架处理，一般不用改。
5. 可先不配环境变量，点 **Deploy**；部署完成后再到 **Settings → Environment Variables** 补全（见下文 **③**），并 **重新部署** 一次使变量生效。

---

## ② 确认生产分支为 `main`（Settings → Git）

1. 进入你的项目（例如名称 **web**）→ 顶部 **Settings**（不是项目首页的 Deployments）。
2. 左侧点 **Git**。
3. 你会看到 **Connected Repository**（例如 `kyle-zck/-web`）— 表示已关联 GitHub。
4. **在同一页继续向下滚动**，查找与 **Production Branch** / **生产分支** 相关的设置（界面文案可能为英文）：
   - 应选择 **`main`**。
   - 若此处没有下拉框，可到 **Settings → Environments** 查看 **Production** 环境绑定的分支（以你账号当前 Vercel 版本为准）。
5. **保存**（若有 Save 按钮）。

**说明**：只要生产分支是 `main`，那么 **只有 `main` 上的提交**会更新线上「正式环境」；其它分支（含 **`dev`**）的推送会生成 **Preview（预览）** 部署，无需额外插件。

---

## ② 补充：Deploy Hooks 里的 Branch 要不要填 `dev`？

在 **Settings → Git** 页面下方可能有 **Deploy Hooks**：

- **作用**：生成一个 **URL**，访问该 URL 会**手动触发一次**指定分支的部署（适合外部 CI、定时任务等）。
- **与日常开发的关系**：**不是必须**。你 **git push origin dev** 后，Vercel 会**自动**为 `dev` 建 Preview，**不必**先建 Deploy Hook。
- **Branch 填什么**：
  - 若你要「用 Hook 专门触发 **正式环境**」→ 一般填 **`main`**（与生产分支一致）。
  - 若你要「用 Hook 专门触发 **预览线**」→ 可填 **`dev`**，得到只部署 `dev` 的链接。

**结论**：多数情况 **不用创建 Deploy Hook**；红框里的 Branch 仅在你**需要那条触发链接**时按目标分支填写。

---

## ③ 环境变量（Settings → Environment Variables）

**从零建 Postgres + 弹窗「Key / Value / Environments / Sensitive」逐项说明**：见根目录 **[`VERCEL-STEP3-ENV-AND-DB.md`](./VERCEL-STEP3-ENV-AND-DB.md)**。

1. **Settings** → 左侧 **Environment Variables**。
2. 点击 **Add** / **Add New**：
   - **Key**：变量名（与 `.env.example` 一致，区分大小写）。
   - **Value**：不要带引号，粘贴完整值。
   - **Environments**：至少勾选 **Production**；若 `dev` 也要连数据库，再勾选 **Preview**（建议 Preview 也配一套，可用另一套测试库）。
3. 线上 **剧目存储** 建议必配：

| Key | 建议值 | 勾选环境 |
|-----|--------|----------|
| `SERIES_STORAGE` | `pg` | Production + Preview |
| `DATABASE_URL` | Postgres 连接串（或 `PG_URL` 二选一） | Production + Preview |

4. **后台登录密钥**（不要用默认弱密码）：

| Key | 说明 |
|-----|------|
| `ADMIN_KEY` | 强随机字符串；Production 与 Preview 可相同或分开 |

5. **S3**（若用封面上传）：`S3_ENDPOINT`、`S3_REGION`、`S3_BUCKET`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`S3_PUBLIC_BASE_URL` — 按需为 Production / Preview 分别配置。

6. 点 **Save**。  
7. **重要**：已存在的部署**不会**自动拿到新变量。请到 **Deployments** → 选中最新一条 → **⋯** → **Redeploy**（或推送一个空 commit），新环境变量才会生效。

### 为什么线上要 `pg` + `DATABASE_URL`？

Vercel Serverless **没有持久本地磁盘**，不能像本机一样长期写 `data/*.json`。`SERIES_STORAGE=local` 在云上不可靠。详见下方「限制说明」。

---

## ④ 部署与验证

1. 本地执行 **`npm run build`** 通过后再依赖线上构建（失败时对照 **Build Logs**）。
2. **推 `dev`**：打开 **Deployments**，应出现类型为 **Preview** 的部署，点进去有预览域名。
3. **合并到 `main`**：应出现 **Production** 部署，域名一般为项目生产域名。
4. 访问 **`/admin/login`**，使用你在 Vercel 配置的 **`ADMIN_KEY`** 登录（与本地 `.env.local` 无关，以 Vercel 为准）。

---

## ⑤ 限制说明（JSON 与标签库）

- 剧目主数据在 **`SERIES_STORAGE=pg`** 时可正常用数据库。
- 部分后台接口仍读写 **`data/*.json`**（标签库、存储路径配置等），在纯 Serverless 上**无法像本地一样持久**；若需长期保存，后续要改为数据库或对象存储/KV（当前仓库未实现）。

---

## ⑥ 其它设置入口（按需）

| 需求 | 路径 |
|------|------|
| 改 Node 版本、安装命令 | **Settings → General** 或 **Build and Deployment** |
| 自定义构建命令 | **Settings → Build and Deployment** |
| 域名 | **Settings → Domains** |

---

## ⑦ 文档链接

- [Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Git 集成](https://vercel.com/docs/git)
