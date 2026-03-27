# popularreels.com 分步配置文档

本文用于把 `popularreels.com` 正式接入当前项目（Namecheap + Cloudflare + Vercel + Supabase），并完成上线后验证。

---

## 0. 目标与架构

- 域名注册商：Namecheap（只管理域名所有权）
- DNS 托管：Cloudflare（作为权威 DNS）
- 网站部署：Vercel
- 认证与数据库：Supabase

结论：  
Namecheap 只需要填写 Cloudflare 的 2 条 Nameserver。  
后续所有 DNS 记录都在 Cloudflare 配置，不在 Namecheap 配置。

---

## 1. 在 Cloudflare 获取两条 Nameserver

### 1.1 若已添加站点

1. 登录 Cloudflare。
2. 进入站点列表，点击 `popularreels.com`。
3. 打开 `Overview` 页面。
4. 找到 `Cloudflare Nameservers` 区块。
5. 复制两条类似：
   - `xxxx.ns.cloudflare.com`
   - `yyyy.ns.cloudflare.com`

### 1.2 若找不到站点

1. 点击 `Add a Site`。
2. 输入 `popularreels.com`。
3. 完成向导（Free 计划即可）。
4. 在最后一步拿到 2 条 Nameserver。

---

## 2. Namecheap 切换到 Cloudflare Nameserver

1. 登录 Namecheap，进入域名管理。
2. 找到 `popularreels.com` 的 `Nameservers` 设置。
3. 选择 `Custom DNS`（自定义 DNS）。
4. 填写：
   - 名称服务器 1：Cloudflare 第 1 条
   - 名称服务器 2：Cloudflare 第 2 条
5. 保存。

注意：
- 生效时间通常几分钟到几小时。
- 生效后 DNS 解析应在 Cloudflare 配，不要再在 Namecheap 配记录。

---

## 3. Vercel 添加正式域名

在 Vercel 项目 `Settings -> Domains`：

1. 添加 `www.popularreels.com`（Production）。
2. 添加 `popularreels.com`。
3. 将 `popularreels.com` 设置为跳转到 `www.popularreels.com`（建议 `308 Permanent Redirect`）。
4. 保留默认 `*.vercel.app` 域名（无需删除）。

---

## 4. Cloudflare DNS 记录（按 Vercel 提示填写）

到 Cloudflare `DNS -> Records`：

1. 为根域 `@` 添加/修改 `A` 记录：
   - Type: `A`
   - Name: `@`
   - Value: 使用 Vercel 给出的 IP（示例：`216.198.79.1`）
   - Proxy: `DNS only`（灰云）
2. 为 `www` 添加/修改 `CNAME` 记录：
   - Type: `CNAME`
   - Name: `www`
   - Value: 使用 Vercel 给出的目标（示例：`20c83ce26cd977eb.vercel-dns-017.com`）
   - Proxy: `DNS only`（灰云）

清理冲突（必须）：
- 删除 `@` 的其他 A/AAAA 冲突记录。
- 删除 `www` 的其他 A/CNAME 冲突记录。
- `www` 不能同时存在 A 与 CNAME。

---

## 5. 回到 Vercel 刷新验证

在 `Settings -> Domains` 页面对两个域名点 `Refresh`：

- 预期状态：都变成 `Valid`
- 如仍 `Invalid`：
  - 检查 Cloudflare 记录值是否与 Vercel 当前提示完全一致
  - 确认 Cloudflare 记录为 `DNS only`（灰云）
  - 再等待 5-30 分钟

---

## 6. Supabase 回调域名配置（登录必须）

Supabase 控制台：`Authentication -> URL Configuration`

### Site URL
- `https://www.popularreels.com`

### Redirect URLs（每行一个）
- `https://www.popularreels.com/auth/callback`
- `https://popularreels.com/auth/callback`
- `http://localhost:3000/auth/callback`

---

## 7. Vercel 环境变量检查（Production + Preview）

必配：

- `SERIES_STORAGE=pg`
- `DATABASE_URL=...`（或 `SUPABASE_DB_URL` / `PG_URL` 三选一）
- `NEXT_PUBLIC_SUPABASE_URL=...`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`
- `ADMIN_KEY=...`
- `USER_TOKEN_ENC_KEY=...`（建议 32+ 随机字符串）

若使用对象存储（R2/S3）：

- `S3_PUBLIC_BASE_URL=...`
- `S3_ENDPOINT=...`
- `S3_BUCKET=...`
- `S3_ACCESS_KEY_ID=...`
- `S3_SECRET_ACCESS_KEY=...`

改完后执行一次 `Redeploy`（建议清缓存重部署）。

---

## 8. 上线后验收（按顺序）

1. `https://www.popularreels.com` 可访问。
2. `https://popularreels.com` 自动跳转到 `www`。
3. OAuth 登录可成功回调，不报 `callback` 错误。
4. `https://www.popularreels.com/admin/config` 能加载并保存。
5. 前台 `/store` 能读取后台配置并展示最新内容。

---

## 9. 常见问题排查

### 9.1 Vercel 仍显示 Invalid Configuration

- Nameserver 还未完全生效（等待）
- Cloudflare 记录与 Vercel 提示不一致（值填错）
- Cloudflare 开了代理（橙云）导致验证失败
- DNS 有冲突记录未删除

### 9.2 OAuth 登录失败

- Supabase `Site URL` 不是正式域名
- `Redirect URLs` 缺少 `/auth/callback`
- Vercel 环境变量缺失 `NEXT_PUBLIC_SUPABASE_*`

### 9.3 后台保存失败

- 线上未配置数据库连接串（`DATABASE_URL` 等）
- 环境变量配置后未重新部署

---

## 10. 执行清单（可打勾）

- [ ] Cloudflare 获取到两条 Nameserver
- [ ] Namecheap 已切换到这两条 Nameserver
- [ ] Vercel 已添加 `www` 与根域并设置重定向
- [ ] Cloudflare DNS 两条记录已按 Vercel 新值配置
- [ ] Cloudflare 记录已设置为 DNS only（灰云）
- [ ] Vercel Domains 状态显示 Valid
- [ ] Supabase Site URL / Redirect URLs 已更新
- [ ] Vercel 环境变量已补齐并完成重部署
- [ ] 正式域名前台和后台功能验收通过

