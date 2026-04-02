# 生产环境：封面用 HTTPS（S3/R2）+ 前台 API 与静态资源缓存 + 媒体直连策略

本文说明：
1. **如何把封面/海报从超大 Base64 改为对象存储 URL**
2. **如何加大 `/api/series` 等缓存**（配合 CDN / Vercel Edge）
3. **视频/图片加载策略**：默认直连、代理做兜底

**→ 想按「一步步点击操作」来做**：请看 **[《加载慢 — 一步步优化操作指南》](./PERF-OPTIMIZATION-STEPS.md)**（含 Network 自检、环境变量、R2 配置顺序）。

更基础的 Supabase + R2 变量说明见 **[`SUPABASE-R2.md`](./SUPABASE-R2.md)**。

---

## 一、为什么不要用 Base64 存封面？

- Base64 会膨胀约 **33%**，且整段塞进 **PostgreSQL `text` / JSON**，每次 **`GET /api/series`** 都要把大图字符串序列化进 JSON，**首屏与列表会非常慢**。
- 正确做法：库里只存 **短 HTTPS URL**（如 `https://cdn.example.com/covers/xxx.jpg`），图片走 **CDN 边缘缓存**，浏览器可并行加载、可缓存。

---

## 二、用 Cloudflare R2（或 AWS S3）上传封面 — 操作步骤

### 1. 在 Cloudflare 创建 R2 桶与 API 凭证

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → **Create bucket**（例如 `reelshorts-media`）。
2. **R2** → **Manage R2 API Tokens** → 创建 **API Token**（权限需能对该桶 **Object Read & Write**）。
3. 记下：
   - **Access Key ID**、**Secret Access Key**
   - **Account ID**（R2 概览页可见）

### 2. 让浏览器能访问图片（公网 URL）

任选其一：

| 方式 | 说明 |
|------|------|
| **A. R2 公开访问 + 默认域名** | 桶设置里启用 **Public access**，使用 R2 提供的 **Public bucket URL**（形如 `https://pub-xxxxx.r2.dev`）。把该前缀填到 **`S3_PUBLIC_BASE_URL`**（不要带末尾 `/`）。 |
| **B. 自定义域名（推荐）** | 在 R2 桶绑定 **Custom Domain**（如 `cdn.yourdomain.com`），DNS CNAME 到 R2。HTTPS 由 Cloudflare 托管。`S3_PUBLIC_BASE_URL=https://cdn.yourdomain.com`。 |

> 浏览器里用的必须是 **HTTPS** 的公网地址；不要把仅服务端可用的 `*.r2.cloudflarestorage.com` 当图片地址给前端（除非你真的配置了对应公开策略）。

### 3. 填写 Vercel / 服务器环境变量

与项目 **`.env.example`** 一致（部署在 Vercel 时在 **Project → Settings → Environment Variables** 添加）：

```env
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=你的桶名
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_BASE_URL=https://cdn.yourdomain.com
```

保存后 **重新部署** Next 应用，使服务端读取到新变量。

### 4. 在后台上传封面验证

1. 打开 **`/admin`** → 剧目上传或 **编辑剧目** → **上传封面**。
2. 接口 **`POST /admin/api/upload/cover`** 会：
   - 已配置 S3：上传到桶内路径 `covers/<时间戳>-<文件名>`，返回 **`coverUrl` 为 `S3_PUBLIC_BASE_URL/covers/...`**。
   - 未配置 S3：仍回退到本地 **`/uploads/covers/...`**（仅适合本机开发）。
3. 保存剧目后，数据库里 **`cover` / `poster`** 字段应为 **https 开头的短 URL**，而不是 `data:image/...`。

### 5. 已有剧目仍是 Base64 怎么办？

- **推荐**：在后台 **编辑该剧目**，重新 **上传封面**（或换一张图），保存后会写入新 URL。
- **批量**：若有脚本能力，可把图片先传到 R2，再在数据库里把 `cover`/`poster` 更新为对应 URL（需自行操作，生产前务必备份）。

---

## 三、加大 `/api/series`、标签目录缓存（CDN / Vercel）

代码已对 **`GET /api/series`**、**`GET /api/tag-catalog`**、**`GET /api/app-config`** 设置：

- 服务端 **`unstable_cache`**（跨请求复用查询结果）
- 响应头 **`Cache-Control: public, s-maxage=..., stale-while-revalidate=...`**（供 **CDN / Vercel Edge** 缓存 JSON）

### 环境变量（按需调大 = 更省数据库、更新略延迟）

在 **`.env.local` / Vercel 环境变量** 中设置：

| 变量 | 含义 | 生产建议（可按业务改） |
|------|------|------------------------|
| **`PUBLIC_SERIES_API_REVALIDATE`** | 剧目列表 API 缓存秒数 | `120`～`300`（更新剧目后最多延迟这么久出现在列表边缘缓存） |
| **`PUBLIC_TAG_CATALOG_REVALIDATE`** | 标签目录 API 缓存秒数 | `300`～`600`（标签不常改可更大） |
| **`PUBLIC_APP_CONFIG_REVALIDATE`** | 站点配置 API（导航品牌/Logo 等）缓存秒数 | `120`～`300` |

修改后需 **重新部署**（或本地重启 `next dev`）。

### 说明

- **`s-maxage`**：边缘节点可缓存时长；**`stale-while-revalidate`**：过期后仍可先返回旧内容并在后台刷新。
- 后台 **新增/改剧目** 后，若希望用户立刻看到最新列表，可把 **`PUBLIC_SERIES_API_REVALIDATE` 调小**（如 `30`），或等待当前 TTL 过期。
- 若需「改库后立刻失效缓存」，要在管理端接口里对接 **`revalidateTag`**（当前项目以 TTL 为主，未做按标签失效）。

---

## 四、静态资源（本地上传的 `/uploads/...`）

若未上 S3、图片仍在 **`public/uploads/`**，项目在 **`next.config.mjs`** 里为 **`/uploads/*`** 增加了较长 **`Cache-Control`**，便于浏览器与中间层缓存（文件名带时间戳时更安全）。

生产仍 **强烈建议** 封面走 **R2/S3 + 自定义域名 CDN**，而不是把大文件长期放应用服务器磁盘。

---

## 五、视频/图片加载策略：优先直连，代理兜底

### 策略说明

代码按以下优先级加载视频和图片：

**视频（mp4 / m3u8 / ts）：**
1. 首选：直连 CDN/R2 URL（最低延迟）
2. 兜底：自动切换到 `/api/video/proxy?src=…`（服务端凭证读取，可靠性优先）

**图片（webp / jpg / png）：**
1. 首选：直连 CDN/R2 URL（走 `next/image` 优化：WebP/Avif 转换 + 响应式 srcset）
2. 兜底：直连失败时自动切换到 `/api/video/proxy?src=…`

### 为什么默认直连？

- 直连走 **Cloudflare 边缘网络**，比经过 Vercel 服务端代理延迟更低
- 图片直连可被 `next/image` 吃到内置 WebP/Avif 转换和 CDN 缓存优化
- 视频直连带宽不走 Vercel serverless，减少 Vercel 出站费用

### 何时会走代理？

| 场景 | 是否走代理 | 原因 |
|------|-----------|------|
| 预签名 URL（含 `signature`/`token`/`X-Amz-` 参数） | ✅ 是 | 凭证不能暴露到客户端 |
| `NEXT_PUBLIC_MEDIA_PROXY_FORCE=1` | ✅ 是 | 强制所有媒体走代理 |
| 直连加载失败（网络断连、403 等） | ✅ 是（自动切换） | 组件层 fallback |

### 常见问题

| 问题 | 解决方式 |
|------|----------|
| `net::ERR_CONNECTION_CLOSED` | 视频会自动切换到代理兜底；如频繁出现建议绑定自定义域名到 R2 |
| 图片加载失败 | `next/image` 的 `onError` 会自动切换 chain 下一项（最终到 `/api/video/proxy`） |
| 预签名 URL 被缓存 | 预签名 URL 有时效，建议上传时直接用无凭证的公开 URL |

---

## 六、检查清单（上线前）

- [ ] `S3_*` 已配齐，`S3_PUBLIC_BASE_URL` 为 **HTTPS** 且浏览器可直接打开一张测试图 URL。
- [ ] 新上传封面的剧目，`cover`/`poster` **不是** `data:image/...`。
- [ ] 已按需设置 **`PUBLIC_SERIES_API_REVALIDATE`** / **`PUBLIC_TAG_CATALOG_REVALIDATE`** / **`PUBLIC_APP_CONFIG_REVALIDATE`**。
- [ ] 在浏览器 **Network** 里查看 **`/api/series?lite=1`** 响应头含 **`Cache-Control`**，体积明显小于全量分集版本。
