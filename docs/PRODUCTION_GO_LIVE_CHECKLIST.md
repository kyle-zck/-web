# 生产环境上线联调清单（Vercel + Cloudflare + Supabase）

更新时间：2026-03-26  
目标域名示例：`https://www.popularreels.com`

---

## 1. 目标与范围

- 确保域名解析、HTTPS、回调地址、环境变量、后台配置在生产环境一致可用。
- 避免常见上线故障：回调失败、静态资源 404、配置保存失败、跨域/重定向错误。

---

## 2. 上线前信息准备

- 主域名：`popularreels.com`
- WWW 域名：`www.popularreels.com`
- Vercel 项目已创建并已连接 Git 仓库
- Cloudflare 已接入该域名
- Supabase 项目可访问（Auth 已启用）

---

## 3. DNS 与域名层检查（Cloudflare）

## 3.1 Cloudflare Nameserver（在 Namecheap 填写）

### 步骤

1. 进入 Cloudflare 站点首页，选择你的域名。
2. 打开 `Overview` 页面，找到 Cloudflare 分配的两条 Nameserver。
3. 去 Namecheap 域名管理，把 Nameserver 改为这两条。

### 预期

- Namecheap 显示为自定义 Nameserver（Cloudflare 提供值）。
- Cloudflare 状态变为 Active（可能需等待传播）。

---

## 3.2 Cloudflare DNS 记录

### 建议记录

- `A` 记录：`@` -> `76.76.21.21`（Vercel）
- `CNAME` 记录：`www` -> `cname.vercel-dns.com`

### 代理建议

- 上线初期建议 DNS only（灰云）以减少代理干扰。
- 稳定后再评估是否开启代理（橙云）。

### 预期

- `dig popularreels.com`、`dig www.popularreels.com` 能解析到预期目标。

---

## 4. Vercel 配置检查

## 4.1 Domain 绑定

### 步骤

1. Vercel 项目 -> `Settings` -> `Domains`
2. 添加：
   - `popularreels.com`
   - `www.popularreels.com`
3. 设置主域（建议 `www.popularreels.com`）
4. 配置域名重定向（另一个域名 301 到主域）

### 预期

- 两个域名状态均为 Valid Configuration。
- 访问非主域会自动跳转主域。

---

## 4.2 环境变量（Production）

在 Vercel -> `Settings` -> `Environment Variables` 核对：

- `NEXT_PUBLIC_SITE_URL=https://www.popularreels.com`
- `DATABASE_URL=...`
- `SUPABASE_URL=...`
- `SUPABASE_ANON_KEY=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`（仅服务端）
- 其他项目依赖变量（支付、存储、第三方登录等）

> 修改后必须触发一次 Redeploy。

---

## 5. Supabase 配置检查（Auth）

进入 Supabase -> `Authentication` -> `URL Configuration`：

- `Site URL`：`https://www.popularreels.com`
- `Redirect URLs` 至少包含：
  - `https://www.popularreels.com/**`
  - 如有裸域跳转，也可加 `https://popularreels.com/**`

若使用 OAuth（Google/Facebook/Apple）：

- 对应平台回调地址必须与 Supabase/生产域名一致
- 避免 `localhost` 回调残留在生产配置里

---

## 6. 应用层关键联调

## 6.1 前台访问链路

### 检查项

- 首页可打开，静态资源无大量 `/_next/static/* 404`
- 登录/注册/游客访问正常
- 个人页能获取 UID
- 商店页/订阅弹窗可正常加载配置

---

## 6.2 后台访问链路

### 检查项

- `/admin/config` 可加载可保存
- `/admin/recharge` 可新增/删除/筛选
- `/admin/users` 可看到充值统计字段
- `/admin/views` 切换 tab 加载正常
- 出错时有错误提示且可“查询/重试”

---

## 6.3 数据一致性

### 检查项

- 前台充值后，钱包/个人页可见历史
- 后台用户管理可见对应充值统计
- 会员剩余天数逻辑一致（过期不可看会员内容）

---

## 7. 生产验证命令（可选）

可在本地终端执行：

```bash
curl -I https://www.popularreels.com
curl -I https://popularreels.com
```

预期：

- 主域返回 `200`（或可接受的缓存状态码）
- 非主域返回 `301/308` 重定向到主域

---

## 8. 常见问题排查

## 8.1 找不到 Cloudflare Nameserver

- 必须先在 Cloudflare 成功添加站点后才会分配
- 路径：Cloudflare 站点 -> `Overview` -> Nameservers

## 8.2 域名已解析但 Vercel 仍未生效

- 检查 DNS 是否完全匹配 Vercel 要求
- 等待 DNS 传播（通常几分钟到数小时）
- 在 Vercel Domains 页点击刷新校验

## 8.3 登录回调失败

- 检查 Supabase Site URL/Redirect URLs 是否为生产域名
- 检查 Vercel `NEXT_PUBLIC_SITE_URL`
- 检查 OAuth 提供商控制台回调配置

## 8.4 后台保存配置失败

- 检查 `DATABASE_URL` 是否在 Production 环境配置
- 检查数据库连接白名单/网络策略
- 查看 Vercel Functions 日志定位具体错误

## 8.5 静态资源 404

- 先确认是否命中旧缓存（强刷）
- 确认当前部署版本与域名绑定一致
- 若是开发环境问题，清理 `.next` 后重启（生产不建议直接类比）

---

## 9. 上线验收标准

- 域名访问、HTTPS、重定向全部通过
- 前后台关键流程全部通过
- Auth 回调通过
- 配置保存与读取通过
- 无阻断性 404 / 500 / 无限 Loading 问题

---

## 10. 回滚预案（建议）

- 保留最近一个稳定部署版本（Vercel）
- 如出现阻断问题：
  1. 立即回滚到稳定版本
  2. 保留错误日志与复现路径
  3. 修复后在预发环境复测再重新发布

