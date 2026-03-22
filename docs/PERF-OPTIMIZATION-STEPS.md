# 加载慢 — 一步步优化操作指南

本文把 **[封面体积](#一封面不要用超大-base64改用-r2s3-短-url)**、**[API 缓存](#二调大-api-缓存环境变量)**、**[部署与 CDN](#三部署地区与-cdn)**、**[浏览器自检](#四用浏览器-network-自检)** 写成可照着点的步骤。更技术说明见 [`COVER-CDN-AND-API-CACHE.md`](./COVER-CDN-AND-API-CACHE.md)。

---

## 一、封面不要用超大 Base64（改用 R2/S3 短 URL）

**目标**：数据库里的 `cover` / `poster` 是 **`https://...` 短链接**，不是 `data:image/png;base64,...` 那种超长字符串。

### 步骤 1：确认当前问题

1. 打开网站前台 **列表页** 或 **首页**，按 **F12**（或右键 → 检查）打开开发者工具。
2. 切到 **Network（网络）**，筛选 **Fetch/XHR**。
3. 点击请求 **`/api/series`** 或 **`/api/series?lite=1`**，看 **Response（响应）**。
4. 若看到某部剧的 `cover`/`poster` 以 **`data:image/`** 开头且特别长 → 说明仍在用 Base64，**列表 JSON 会很大、加载慢**。

### 步骤 2：准备对象存储（以 Cloudflare R2 为例）

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com) 并登录。
2. 左侧进入 **R2**。若首次使用，页面可能出现 **「Get started with R2」** 并要求绑定 **支付方式**（信用卡或 PayPal）：这是 Cloudflare 的常见流程，**免费额度内通常仍为 $0**（页面会显示 *Total Due Now: $0.00*），但需先登记付款方式才能开通 R2 并出现 **Create bucket**。
3. 完成上述开通后，在 **R2** 中点击 **Create bucket**，输入桶名（例如 `reelshorts-media`）→ 创建。
4. 同一页面进入 **Manage R2 API Tokens** → **Create API token**。
5. 权限选择能 **读取 + 写入** 你刚建的桶 → 创建后 **立刻复制并保存**：
   - **Access Key ID**
   - **Secret Access Key**
6. 在 R2 概览页记下 **Account ID**（一串十六进制）。

### 步骤 3：配置「浏览器能打开的图片地址」

任选一种：

| 做法 | 你要做的事 |
|------|------------|
| **A. R2 默认公网域名** | 桶 → **Settings** → 打开 **Public access**，使用形如 `https://pub-xxxxx.r2.dev` 的地址作为图片前缀。 |
| **B. 自定义域名（更推荐）** | 桶 → **Custom Domain**，绑定 `cdn.你的域名.com`，在 DNS 里按 Cloudflare 提示加 **CNAME**。 |

最终你需要一个 **HTTPS** 前缀，例如：`https://cdn.example.com`（**不要**带末尾 `/`）。

### 步骤 4：把变量写进环境（本地 + 线上）

**本地（开发机）：**

1. 复制项目根目录的 **`.env.example`** 为 **`.env.local`**（若已有则编辑它）。
2. 填写（把示例值换成你的真实值）：

```env
S3_ENDPOINT=https://<你的_ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=你的桶名
S3_ACCESS_KEY_ID=你的AccessKeyId
S3_SECRET_ACCESS_KEY=你的Secret
S3_PUBLIC_BASE_URL=https://你的公网HTTPS前缀
```

3. 保存文件后，**关掉并重新运行** `npm run dev`（改环境变量后必须重启进程）。

**Vercel（线上）：**

1. 打开 Vercel → 你的项目 → **Settings** → **Environment Variables**。
2. 按上表 **同名** 添加每一条变量（Production / Preview 按需勾选）。
3. 进入 **Deployments**，对最新部署点 **⋯** → **Redeploy**（**重新部署**后线上才读到新变量）。

### 步骤 5：在后台重新上传封面并验证

1. 浏览器打开 **`https://你的域名/admin`**（或本地 `http://localhost:3000/admin`），登录后台。
2. 打开 **剧目编辑** → **上传封面** → **保存**。
3. 再查一次 **Network** 里 **`/api/series?lite=1`** 的响应：该剧的 `cover`/`poster` 应为 **`https://...`**。
4. 在地址栏 **单独打开** 该图片 URL，能直接看到图即表示 **CDN/公网** 配置正确。

### 步骤 6：旧数据仍是 Base64 时

- **最省事**：对每部旧剧在后台 **编辑 → 重新上传封面 → 保存**。
- 批量改库需自行备份数据库后再操作，本文不展开。

---

## 二、调大 API 缓存（环境变量）

**目标**：减少数据库压力、加快重复访问；**代价**是改剧目后，边缘缓存里可能 **延迟几十秒～几分钟** 才更新（可按业务调小）。

### 步骤 1：弄清三个变量

| 环境变量 | 影响的接口 | 作用（通俗） |
|----------|------------|----------------|
| `PUBLIC_SERIES_API_REVALIDATE` | `GET /api/series`、`?lite=1` | 剧目列表多久可被 CDN/边缘认为「还新鲜」 |
| `PUBLIC_TAG_CATALOG_REVALIDATE` | `GET /api/tag-catalog` | 标签目录缓存多久 |
| `PUBLIC_APP_CONFIG_REVALIDATE` | `GET /api/app-config` | 站点配置（导航品牌等）缓存多久 |

数值单位：**秒**。越大越省资源、更新越慢。

### 步骤 2：本地设置

1. 打开 **`.env.local`**。
2. 在文件末尾增加（可按需改数字）：

```env
PUBLIC_SERIES_API_REVALIDATE=180
PUBLIC_TAG_CATALOG_REVALIDATE=600
PUBLIC_APP_CONFIG_REVALIDATE=180
```

3. 保存后 **重启** `npm run dev`。

### 步骤 3：Vercel 设置

1. **Settings** → **Environment Variables** → **Add**。
2. 名称、值与上表一致，**Save**。
3. **Redeploy** 一次。

### 步骤 4：改完怎么确认「生效」

见本文 **[第四节](#四用浏览器-network-自检)**：响应头里应有 **`Cache-Control`**，且含 **`s-maxage`**（秒数与变量对应或接近项目内逻辑）。

---

## 三、部署地区与 CDN

**目标**：用户离 **应用服务器 / 边缘节点** 越近，首包延迟越低。

### 步骤 1：Vercel 区域

1. Vercel 项目 → **Settings** → **Functions**（或项目 General 中的区域相关项，以当前控制台为准）。
2. 若主要用户在 **中国大陆以外**，可选离用户近的 **Region**（如新加坡、东京等，以 Vercel 可选列表为准）。
3. 保存后 **重新部署**。

### 步骤 2：图片走 CDN

- 封面已用 **`S3_PUBLIC_BASE_URL`** 指向 **Cloudflare R2 自定义域名** 时，图片通常已由 Cloudflare 边缘缓存。
- 若域名 DNS 也托管在 Cloudflare，可再开启 **Proxy（小云朵）** 等，具体以 Cloudflare 文档为准。

### 步骤 3：不要指望「单区域解决所有问题」

- API 与页面在 Vercel，数据库在 **Supabase 美东** 时，仍会有跨洋延迟；封面用 **CDN URL** 比缩数据库延迟更立竿见影。

---

## 四、用浏览器 Network 自检

**目标**：确认接口带了缓存头；二次进入时能走缓存，减轻等待感。

### 步骤 1：打开 Network

1. **F12** → **Network**。
2. 勾选 **Preserve log**（保留日志，可选）。
3. 建议勾选 **Disable cache** 只做「第一次请求」测试时 **关掉**（测第二次访问时要 **关** Disable cache）。

### 步骤 2：检查 `Cache-Control`

1. 刷新页面，在列表里找到 **`/api/app-config`**、**`/api/series?lite=1`**（或 `/api/series`）。
2. 点开请求 → **Headers** → **Response Headers**。
3. 确认存在 **`cache-control`**（或 **`Cache-Control`**），且包含类似：
   - `public`
   - `s-maxage=...`（秒）

若没有：检查是否改完环境变量却 **没重启 dev / 没 Redeploy**。

### 步骤 3：第二次访问看 304 / disk cache

1. **关掉** Network 里的 **Disable cache**（重要）。
2. **正常刷新**同一页面两次（或从别的页再点回首页）。
3. 再看同一接口：
   - 可能显示 **`304 Not Modified`**（与服务器校验后未改 body）；或
   - **Size** 列显示 **disk cache** / **memory cache**（从磁盘/内存读缓存）。

不同浏览器文案略有差异，只要 **第二次明显不再下载完整 JSON** 即说明缓存链路在工作。

### 步骤 4：对比「lite」体积

1. 打开 **`/api/series?lite=1`** 的 Response。
2. 确认每条剧目 **没有**带全部分集大字段时，体积应 **明显小于** 不带 `lite=1` 的全量接口（项目已对 lite 做了裁剪）。

---

## 五、常见问题

| 现象 | 可排查 |
|------|--------|
| 改了 `.env.local` 没变化 | 必须 **重启** `next dev`；Next 不会热更新环境变量。 |
| Vercel 改了变量仍慢 | 必须 **Redeploy**；并确认变量加在 **Production**（或你当前访问的环境）。 |
| 始终没有 Cache-Control | 看请求是否打到 **本地 dev**（部分行为与生产不完全一致）；以 **线上** 为准。 |
| 列表还是慢 | 先查 **封面是否仍是 Base64**；再查 **数据库区域** 与 **R2 域名** 是否 HTTPS 可直连。 |

---

## 六、检查清单（打印用）

- [ ] 数据库/接口里剧目 `cover`/`poster` **不是** `data:image/...`
- [ ] `S3_PUBLIC_BASE_URL` 在浏览器能 **直接打开** 一张测试图
- [ ] `.env.local` 或 Vercel 已设置 **`PUBLIC_*_REVALIDATE`**（按需）
- [ ] Network 中 **`/api/series?lite=1`**、**`/api/app-config`** 有 **`Cache-Control`**
- [ ] 第二次访问出现 **304** 或 **disk cache**（在关闭 Disable cache 时）

完成以上步骤后，再观察首屏与列表是否明显改善。
