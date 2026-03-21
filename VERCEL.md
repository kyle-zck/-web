# Vercel 部署操作指南

> **说明**：我无法代你登录 Vercel。请按下面步骤在浏览器中操作；与仓库内 `DEPLOY.md`、`.env.example` 配合使用。

## 一、首次接入（连接 GitHub）

1. 打开 [vercel.com](https://vercel.com) → 登录（建议用 GitHub 账号）。
2. **Add New… → Project** → **Import** 你的仓库（例如 `kyle-zck/-web`）。
3. **Framework Preset**：保持 **Next.js**（一般会自动识别）。
4. **Root Directory**：仓库根目录（默认 `.`）。
5. **Build & Output**：保持默认 `npm run build` / `.next`（勿改除非你有 monorepo）。

## 二、分支与部署环境（推荐）

在 Vercel 项目 → **Settings → Git**：

| 设置项 | 建议值 | 说明 |
|--------|--------|------|
| **Production Branch** | `main` | 生产环境只跟 `main` |
| 其他分支 | 自动产生 **Preview** | `dev` 推送后会生成预览 URL |

可选：在 **Settings → Git → Ignored Build Step** 里按需配置，避免无关提交触发构建（一般不必）。

## 三、环境变量（必做）

项目 → **Settings → Environment Variables**，按 `.env.example` 逐项添加。

### 生产 / Preview 强烈建议

| 变量 | Production | Preview (dev) | 说明 |
|------|------------|-----------------|------|
| `SERIES_STORAGE` | **`pg`** | **`pg`** 或与本地一致 | 见下方「重要限制」 |
| `DATABASE_URL` 或 `PG_URL` | 生产库连接串 | 可单独建 Preview 数据库 | 与 `pg` 模式配套 |
| `ADMIN_KEY` | **强随机字符串** | 测试用密钥 | 勿用代码里的默认 `admin` |

### S3（封面上传）

若使用对象存储，为 **Production** 与 **Preview** 分别配置（可与本地 `.env.local` 对齐）：

`S3_ENDPOINT`、`S3_REGION`、`S3_BUCKET`、`S3_ACCESS_KEY_ID`、`S3_SECRET_ACCESS_KEY`、`S3_PUBLIC_BASE_URL`

### 重要限制：无持久磁盘

Vercel 的 Serverless 运行时**不能**像本机一样长期写入仓库里的 `data/*.json`（文件系统只读，且实例不持久）。

因此：

- **`SERIES_STORAGE=local` 在 Vercel 上不可靠**（写 `data/series-store.json` 等易失败或无法持久）。
- **推荐生产与预览均使用 `SERIES_STORAGE=pg` + `DATABASE_URL`**（或你自建的兼容存储）。

标签库、剧目标签目录、存储路径等仍走 JSON 文件的接口，在纯 Serverless 上同样**无法长期保存**；若必须在线管理，后续需改为数据库或 Vercel KV / Blob 等（当前仓库未实现）。

## 四、部署与验证

1. 连接仓库后，对 **`dev`** 或 **`main`** 推送一次，等待 **Deployments** 里构建完成。
2. 构建失败时，点开 **Build Logs**：本地先执行 `npm run build` 复现（与日志一致更易排查）。
3. Preview URL 打开前台；后台路径 `/admin`（需先 `/admin/login`，使用你配置的 `ADMIN_KEY`）。

## 五、本地与线上一致性

- 密钥只放在 **Vercel 环境变量** 与本地 **`.env.local`**，勿提交 `.env.local`。
- `data/*.json` 已加入 **`.gitignore`**，新克隆仓库后本地会缺这些文件；开发时由接口读写或 `storage-local` 首次访问时生成（仅本地磁盘有效）。

## 六、常用链接

- [Vercel – Environment Variables](https://vercel.com/docs/projects/environment-variables)
- [Vercel – Git Integration / Production Branch](https://vercel.com/docs/git)
