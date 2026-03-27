# Stripe 真实支付接入步骤（仅支付成功后开会员）

更新时间：2026-03-26

---

## 1. 已完成的代码改造

本仓库已完成以下改造：

- 新增接口：`/api/payments/stripe/checkout`
  - 前端点击 `Pay Now` 时创建 Stripe Checkout Session
  - 不再直接调用充值接口开会员
- 新增接口：`/api/payments/stripe/webhook`
  - 仅在 Stripe webhook 回调 `invoice.paid` 后写入充值并发放会员（自动续费每次都会触发）
- 前端页面：`app/store/page.tsx`
  - 已切换为发起 Stripe 支付跳转
- 安全收口：`/api/user/recharge`
  - 默认禁用前端直充（`ENABLE_FAKE_PAYMENT=1` 才允许，生产必须关闭）

---

## 2. 你需要完成的配置（按顺序）

## 步骤 A：在 Stripe 创建产品与价格

1. 打开 Stripe Dashboard -> `Product catalog`
2. 创建套餐产品（如 Monthly / Yearly）
3. 为每个套餐创建 Price
4. 记录每个价格的 `price_xxx`（后续映射要用）

---

## 步骤 B：配置环境变量（Vercel / 本地）

需要变量：

- `STRIPE_SECRET_KEY=sk_live_xxx`（测试环境可先 sk_test）
- `STRIPE_WEBHOOK_SECRET=whsec_xxx`
- `STRIPE_PRICE_MAP_JSON={"month":"price_xxx","year":"price_yyy"}`

说明：

- `STRIPE_PRICE_MAP_JSON` 的 key 支持 `subscriptionPlans` 里的 `id` 或 `label`
- value 必须是 Stripe `price_xxx`
- 生产必须确保 `ENABLE_FAKE_PAYMENT` 未设置或为 `0`

---

## 步骤 C：配置 Stripe Webhook

1. Stripe -> `Developers` -> `Webhooks` -> `Add destination`
2. Endpoint URL 填：
   - 生产：`https://www.popularreels.com/api/payments/stripe/webhook`
   - 本地联调（可选）：使用 Stripe CLI 转发
3. 勾选事件：
   - `invoice.paid`
   - （可选）`customer.subscription.deleted`（记录取消订阅事件；不建议立刻撤销会员，按到期自然失效）
4. 保存后复制 `Signing secret`（`whsec_...`）
5. 填入环境变量 `STRIPE_WEBHOOK_SECRET`
6. 重新部署（Vercel）

---

## 步骤 D：将前台套餐与 Stripe 价格一一对应

去后台配置套餐（`subscriptionPlans`）后，确保其 `id`/`label` 与环境变量映射匹配：

示例：

```json
STRIPE_PRICE_MAP_JSON={"month":"price_1Rxxx","year":"price_1Ryyy","Month VIP":"price_1Rxxx"}
```

---

## 步骤 E：联调验证（必须做）

### 1) 发起支付

1. 登录用户进入 `/store`
2. 选套餐点击 `Pay Now`
3. 应跳转到 Stripe Checkout（不是直接开会员）

### 2) 支付成功回调

1. 完成测试支付
2. Stripe Webhook 日志里应看到 `invoice.paid` 200
3. 回到站点后再刷新用户状态
4. 会员应在 webhook 成功后生效

### 3) 防绕过验证

手工调用 `/api/user/recharge` 应返回 403（生产要求）

---

## 3. 常见问题排查

## 问题 1：点击 Pay 后提示 payment unavailable

- 检查 `STRIPE_SECRET_KEY` 是否已配置且生效
- 检查 `STRIPE_PRICE_MAP_JSON` 是否包含当前套餐 id/label
- 检查映射值是否是 `price_` 开头

## 问题 2：支付成功但会员没生效

- 检查 webhook 是否收到并返回 200
- 检查 `STRIPE_WEBHOOK_SECRET` 是否正确
- 检查请求 URL 是否是线上真实域名

## 问题 3：用户仍能绕过支付直接开会员

- 检查 `ENABLE_FAKE_PAYMENT` 是否被开启
- 生产环境必须关闭该变量

---

## 4. 生产上线前清单

- [ ] 已配置 `STRIPE_SECRET_KEY`（live）
- [ ] 已配置 `STRIPE_WEBHOOK_SECRET`（live）
- [ ] 已配置 `STRIPE_PRICE_MAP_JSON`
- [ ] webhook endpoint 可达并事件签名通过
- [ ] `/api/user/recharge` 在生产返回 403
- [ ] 完成一次真实流程端到端测试（创建订单 -> 支付 -> webhook -> 会员生效）

