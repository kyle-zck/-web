# 一键执行上线总清单（后台稳定性 + 生产域名联调）

更新时间：2026-03-26  
建议使用方式：按顺序逐项打勾执行（`[ ]` -> `[x]`）

---

## A. 上线前准备

- [ ] 已确认主域名：`https://www.popularreels.com`
- [ ] 已具备管理员账号可登录 `/admin`
- [ ] 已确认 Vercel 项目绑定正确 Git 仓库
- [ ] 已确认 Supabase 项目可访问
- [ ] 已准备回滚方案（可回退到最近稳定部署）

---

## B. 域名与 DNS（Namecheap + Cloudflare）

- [ ] 在 Cloudflare 添加站点成功
- [ ] 在 Cloudflare `Overview` 找到 2 条 Nameserver
- [ ] 在 Namecheap 将 Nameserver 替换为 Cloudflare 提供值
- [ ] 等待生效后 Cloudflare 显示 Active
- [ ] Cloudflare DNS 新增 `A @ -> 76.76.21.21`
- [ ] Cloudflare DNS 新增 `CNAME www -> cname.vercel-dns.com`
- [ ] 上线初期代理状态设置为 DNS only（灰云）

---

## C. Vercel 配置

- [ ] `Settings -> Domains` 添加 `popularreels.com`
- [ ] `Settings -> Domains` 添加 `www.popularreels.com`
- [ ] 设置主域为 `www.popularreels.com`
- [ ] 非主域配置 301/308 跳转到主域
- [ ] 两个域名状态均显示 Valid Configuration

---

## D. 生产环境变量（Vercel）

- [ ] `NEXT_PUBLIC_SITE_URL=https://www.popularreels.com`
- [ ] `DATABASE_URL` 已配置（Production）
- [ ] `SUPABASE_URL` 已配置（Production）
- [ ] `SUPABASE_ANON_KEY` 已配置（Production）
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 已配置（仅服务端）
- [ ] 其他第三方变量（支付/存储/OAuth）已完整配置
- [ ] 修改后已 Redeploy 一次

---

## E. Supabase Auth 回调

- [ ] `Authentication -> URL Configuration -> Site URL` 为 `https://www.popularreels.com`
- [ ] `Redirect URLs` 包含 `https://www.popularreels.com/**`
- [ ] 如需裸域兼容，包含 `https://popularreels.com/**`
- [ ] OAuth 提供商后台回调地址与生产域一致

---

## F. 前台生产冒烟测试

- [ ] 首页打开正常，无阻断性报错
- [ ] 无大量 `/_next/static/* 404`
- [ ] 登录/注册/游客访问正常
- [ ] 游客可获得 UID（不再显示 `UID: —`）
- [ ] 商店页/订阅弹窗加载配置正常
- [ ] 前台充值记录可在个人相关页面查看

---

## G. 后台稳定性总测（加载链路）

以下页面都执行“正常网络 + 异常网络 + 重试恢复”：

- [ ] `/admin/config`
- [ ] `/admin/recharge`
- [ ] `/admin/users`
- [ ] `/admin/views`
- [ ] `/admin/history`
- [ ] `/admin/favorites`
- [ ] `/admin/likes`
- [ ] `/admin/access-list`
- [ ] `/admin/site`
- [ ] `/admin/series/detail`
- [ ] `/admin/series/episodes`
- [ ] `/admin/series/tags`
- [ ] `/admin/series/upload`
- [ ] `/admin`（dashboard）

统一验收点：

- [ ] 不出现无限 Loading
- [ ] 失败时有可见错误提示
- [ ] 有“查询/重试”并能恢复

---

## H. 后台关键提交流程（提交链路）

### H1. 配置类

- [ ] Dashboard 品牌保存成功/失败反馈正常
- [ ] Site 配置保存成功/失败反馈正常
- [ ] Config 页面保存成功/失败反馈正常
- [ ] Security 改密码超时和错误提示正常

### H2. 充值与用户

- [ ] Recharge 新增记录成功（合法 UID）
- [ ] Recharge 删除记录后会员状态按剩余最长记录重算
- [ ] Users 页可看到充值统计字段变化

### H3. 剧目与剧集

- [ ] Series Detail 删除剧目（测试数据）正常
- [ ] Series Detail 批量/HOT HLS 触发与反馈正常
- [ ] Episodes 删除单集（测试数据）正常
- [ ] Episodes 单条/批量资源检查反馈正常
- [ ] Tags 删除标签反馈正常
- [ ] Upload 标题查重/封面上传/预签名上传反馈正常

---

## I. 数据一致性验收

- [ ] 前台充值后，前台可见历史
- [ ] 前台充值后，后台用户管理可见统计
- [ ] 前后台会员状态一致（过期即不可看会员内容）
- [ ] 剩余天数字段逻辑一致（统一口径）

---

## J. 生产快速核验命令（可选）

- [ ] `curl -I https://www.popularreels.com` 返回可用状态
- [ ] `curl -I https://popularreels.com` 返回跳转到主域

---

## K. 问题记录（执行中发现问题就填）

```text
[页面/模块]

[操作步骤]

[实际结果]

[期望结果]

[复现概率]

[环境]

[截图/日志]
```

---

## L. 最终放行标准（全部满足才上线）

- [ ] 域名、DNS、HTTPS、重定向全部通过
- [ ] Supabase 回调全部通过
- [ ] 前后台核心流程全部通过
- [ ] 无阻断级 404/500/无限 Loading
- [ ] 关键保存/删除/提交均有明确反馈
- [ ] 回滚预案已验证可执行

---

## 相关文档

- `docs/ADMIN_E2E_TEST_CHECKLIST.md`
- `docs/PRODUCTION_GO_LIVE_CHECKLIST.md`
- `docs/DOMAIN_SETUP_NAMECHEAP_CLOUDFLARE_VERCEL_SUPABASE.md`

