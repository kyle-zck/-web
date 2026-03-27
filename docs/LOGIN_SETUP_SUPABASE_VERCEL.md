# 登录配置修复指南（Supabase + Vercel）

适用场景：登录弹窗能打开，但邮箱登录/OAuth 按钮不可用、回调失败、登录后不落会话。

---

## 1) 先确认前端环境变量（Vercel Production）

在 Vercel 项目 -> `Settings` -> `Environment Variables`：

- `NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>`
- `NEXT_PUBLIC_SITE_URL=https://www.popularreels.com`

保存后执行一次 Redeploy。

---

## 2) Supabase 站点与回调地址

Supabase -> `Authentication` -> `URL Configuration`：

- `Site URL` 填：`https://www.popularreels.com`
- `Redirect URLs` 至少加：
  - `https://www.popularreels.com/auth/callback`
  - `https://www.popularreels.com/**`
  - （可选）`https://popularreels.com/auth/callback`
  - （可选）`https://popularreels.com/**`

> 项目代码 OAuth 回调固定使用：`/auth/callback`。

---

## 3) 邮箱登录开关（最常见漏项）

Supabase -> `Authentication` -> `Providers` -> `Email`：

- 开启 `Enable Email provider`
- 如果你暂时不配 SMTP，建议先关闭强制邮箱确认（仅测试阶段）
  - 生产建议开启邮箱确认并配置 SMTP

---

## 4) 第三方登录（Google/Facebook/Apple）

Supabase -> `Authentication` -> `Providers`：

### Google
- 打开 Google Provider
- 填 `Client ID` / `Client Secret`
- 在 Google Cloud Console 的 OAuth 回调中加入 Supabase 给你的回调 URL

### Facebook
- 打开 Facebook Provider
- 填 App ID / App Secret
- 在 Facebook Developer 后台添加 Supabase 回调 URL

### Apple
- 打开 Apple Provider
- 配置 Services ID / Key / Team ID / Key ID
- 在 Apple Developer 后台配置回调 URL

> 每个 Provider 页面里 Supabase 都会显示该 Provider 对应回调地址，必须原样加入第三方平台白名单。

---

## 5) 代码侧回调路径核对（本项目）

本项目使用：

- 前端发起 OAuth：`window.location.origin + /auth/callback`
- 服务端回调处理：`app/auth/callback/route.ts`

所以平台配置必须允许 `https://你的域名/auth/callback`。

---

## 6) 联调顺序（建议按顺序）

1. 先测邮箱登录（Sign In / Sign Up）
2. 再测 Google（最快）
3. 再测 Facebook / Apple
4. 最后测生产域名下的完整跳转与会话保持

---

## 7) 快速排查对照

### 现象：点击 OAuth 按钮没反应或报 not configured
- 原因：`NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` 未生效，或 provider 未启用
- 处理：检查 Vercel 环境变量并 Redeploy；检查 Supabase Providers 开关

### 现象：跳回站点后仍未登录
- 原因：`Redirect URLs` 未包含 `/auth/callback`
- 处理：补齐 `https://www.popularreels.com/auth/callback`

### 现象：邮箱注册后无法登录
- 原因：开启了邮箱确认但未配置 SMTP / 未确认邮件
- 处理：测试阶段可先关闭邮箱确认，生产再开启并接入 SMTP

### 现象：生产正常，本地不正常
- 原因：本地 `.env.local` 与 Vercel 配置不一致
- 处理：本地变量与生产对齐，并重启 dev server

---

## 8) 验收标准

- 邮箱登录可用
- 至少 1 个 OAuth（建议 Google）可用
- 登录后刷新页面会话仍在
- 个人页能拿到 UID，不显示 `UID: —`

---

## 9) 逐项实操（可直接照做）

以下步骤按“邮箱 -> Google -> Facebook -> Apple”执行。

## 9.1 邮箱注册/登录（Email Provider）

### A. Supabase 开启 Email

1. 打开 Supabase 控制台 -> `Authentication` -> `Providers` -> `Email`。
2. 打开 `Enable Email provider`。
3. 测试阶段建议：
   - 先关闭强制邮箱确认（不同 UI 文案可能为 `Confirm email` / `Enable email confirmations`）。
4. 点击保存。

### B. 前端验证

1. 打开你的网站登录弹窗。
2. 切到 `Sign Up`，输入邮箱+密码注册。
3. 再切 `Sign In` 用同一账号登录。
4. 刷新页面，确认仍是登录状态。

### C. 生产建议

- 上线前开启邮箱确认，并在 Supabase -> `Authentication` -> `Email Templates` + SMTP 中配置邮件发送。

---

## 9.2 Google 登录（最优先）

你截图里的 Supabase Google 面板已打开，关键是把 Google Cloud 的回调白名单配对。

### A. Supabase 侧

1. Supabase -> `Authentication` -> `Providers` -> `Google`。
2. 打开 `Enable Sign in with Google`。
3. 填 `Client IDs`（可填一个 Web Client ID）。
4. 填 `Client Secret (for OAuth)`。
5. 保存。
6. 复制该页显示的 `Callback URL (for OAuth)`（你项目应为）：
   - `https://iqastxkcyfrwaimqczrj.supabase.co/auth/v1/callback`

### B. Google Cloud 侧

1. 打开 [Google Cloud Console](https://console.cloud.google.com/)。
2. 进入 `APIs & Services` -> `Credentials`。
3. 新建或编辑 `OAuth 2.0 Client ID`（类型选 `Web application`）。
4. 在 `Authorized JavaScript origins` 添加：
   - `https://www.popularreels.com`
   - （可选）`https://popularreels.com`
   - （本地调试）`http://localhost:3000`
5. 在 `Authorized redirect URIs` 添加 Supabase 回调：
   - `https://iqastxkcyfrwaimqczrj.supabase.co/auth/v1/callback`
6. 保存后把 Google 的 `Client ID` / `Client Secret` 回填 Supabase Google Provider。

### C. 网站验证

1. 登录弹窗点击 `Continue with Google`。
2. 完成 Google 授权后应跳回你站点（`/auth/callback` 处理）。
3. 刷新页面仍保持登录态。

---

## 9.3 Facebook 登录

### A. Supabase 侧

1. Supabase -> `Authentication` -> `Providers` -> `Facebook`。
2. 开启 Facebook Provider。
3. 填 `App ID` / `App Secret`，保存。
4. 复制该页显示的 Supabase Callback URL（通常也是 `/auth/v1/callback`）。

### B. Facebook Developer 侧

1. 打开 [Meta for Developers](https://developers.facebook.com/)。
2. 创建应用（类型可选 Consumer）。
3. 添加产品 `Facebook Login`。
4. 在 `Facebook Login` -> `Settings`：
   - `Valid OAuth Redirect URIs` 添加 Supabase 给你的 callback URL（原样粘贴）。
5. 在应用基础设置中填站点域名（如 `www.popularreels.com`）。
6. 将 App 状态切到可用测试（开发模式下仅测试用户可登录）。

### C. 网站验证

1. 点击 `Continue with Facebook`。
2. 授权后能回站并保持登录态。

---

## 9.4 Apple 登录（配置最多）

### A. Apple Developer 侧（先配）

1. 打开 [Apple Developer](https://developer.apple.com/account/)。
2. 创建 `Services ID`（用于网页登录）。
3. 给 Services ID 开启 `Sign in with Apple`。
4. 在配置中填写：
   - Primary App ID（你的应用标识）
   - Return URL：Supabase 提供的 Apple callback URL
   - Domain：`www.popularreels.com`
5. 在 `Keys` 新建支持 `Sign in with Apple` 的 Key，记录：
   - `Key ID`
   - 下载 `.p8` 私钥文件
   - `Team ID`

### B. Supabase 侧

1. Supabase -> `Authentication` -> `Providers` -> `Apple`。
2. 开启 Apple Provider。
3. 填入：
   - Services ID（Client ID）
   - Team ID
   - Key ID
   - Private Key（`.p8` 内容）
4. 保存。

### C. 网站验证

1. 点击 `Continue with Apple`。
2. 完成授权后回站并保持登录态。

---

## 10) 你这个项目的关键白名单（建议直接使用）

### Supabase -> URL Configuration

- `Site URL`: `https://www.popularreels.com`
- `Redirect URLs`:
  - `https://www.popularreels.com/auth/callback`
  - `https://www.popularreels.com/**`
  - `https://popularreels.com/auth/callback`
  - `https://popularreels.com/**`
  - `http://localhost:3000/auth/callback`（本地调试可选）

### Google OAuth（Google Cloud）

- Authorized JavaScript origins:
  - `https://www.popularreels.com`
  - `https://popularreels.com`
  - `http://localhost:3000`
- Authorized redirect URIs:
  - `https://iqastxkcyfrwaimqczrj.supabase.co/auth/v1/callback`

