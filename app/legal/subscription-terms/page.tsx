"use client";

export default function SubscriptionTermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-zinc-100">
      <h1 className="text-2xl font-extrabold">自动续费与增值服务协议</h1>
      <p className="mt-3 text-sm text-zinc-400">生效时间：2026-03-27</p>

      <section className="mt-8 space-y-3 text-sm leading-7 text-zinc-200">
        <p>
          本协议适用于 PopularReels（以下简称“本服务”）的订阅类增值服务（以下简称“订阅服务”）。
          你在本服务中点击“Pay Now/支付/订阅”等按钮并完成付款，即表示你已充分阅读、理解并同意本协议全部条款。
        </p>

        <h2 className="mt-6 text-base font-bold">0. 关键定义</h2>
        <ul className="list-disc pl-6 text-zinc-200">
          <li>
            <span className="font-semibold">订阅周期</span>：按周/月/季度/年等计费周期。
          </li>
          <li>
            <span className="font-semibold">自动续费</span>：在当前周期结束前，支付渠道可能自动发起扣款以续订下一周期。
          </li>
          <li>
            <span className="font-semibold">支付渠道</span>：指 PayPal、银行卡/信用卡发卡行、支付服务提供商等。
          </li>
          <li>
            <span className="font-semibold">会员权益</span>：指订阅服务对应的内容解锁与增值权益，以你购买时页面展示为准。
          </li>
        </ul>

        <h2 className="mt-6 text-base font-bold">1. 自动续费</h2>
        <p>
          你购买的订阅服务默认开启自动续费。为确保服务连续性，在订阅周期结束前，支付渠道可能会自动发起扣款；
          扣款成功后，订阅周期将自动延长，会员权益随之延长。你理解并同意：自动续费扣款时间可能因支付渠道处理规则而存在轻微差异。
        </p>
        <p className="text-zinc-400">
          为保护开发者与内容服务的连续性，本服务要求用户同意本协议后才能发起订阅支付；未同意本协议将无法继续付款流程。
        </p>

        <h2 className="mt-6 text-base font-bold">2. 取消续费</h2>
        <p>
          你确认：本服务不提供在网站页面直接关闭自动续费的功能。若你希望停止续费，请在对应支付渠道内自行取消（取消入口与规则以支付渠道为准）：
        </p>
        <ul className="list-disc pl-6 text-zinc-200">
          <li>
            <span className="font-semibold">PayPal</span>：请在 PayPal 的“订阅/自动付款/自动支付（Automatic payments）”中取消。
          </li>
          <li>
            <span className="font-semibold">银行卡/信用卡</span>：请在发卡行或支付渠道的“订阅/自动扣款/定期扣费”管理中取消。
          </li>
        </ul>
        <p className="text-zinc-400">
          取消仅影响后续扣费，不影响你已支付周期内的会员权益；会员将于当前周期结束后自然到期。若你在接近续费扣款时间取消，支付渠道可能仍已发起扣款或扣款处理中，具体以支付渠道结果为准。
        </p>

        <h2 className="mt-6 text-base font-bold">3. 费用与服务</h2>
        <p>
          订阅费用以支付页面展示为准。订阅服务用于解锁会员内容与相关增值权益（以实际功能为准）。
          若存在折扣、活动价或限时优惠，其适用范围、时间与规则以支付页面展示为准。
        </p>
        <p className="text-zinc-400">
          你理解并同意：支付渠道可能会收取额外费用或税费（如适用），具体以支付渠道账单为准。
        </p>

        <h2 className="mt-6 text-base font-bold">4. 退款与争议</h2>
        <p>
          除法律法规另有规定外，订阅类服务在支付成功后通常不支持退款。若发生重复扣费、未开通成功、扣费成功但权益未生效等异常情况，请优先通过本服务支持渠道联系我们处理。
        </p>
        <p className="text-zinc-400">
          若你选择向支付渠道发起争议/拒付（Chargeback），支付渠道可能冻结相关交易并要求补充材料。为便于快速处理，请你保留付款凭证及相关截图。
        </p>

        <h2 className="mt-6 text-base font-bold">5. 记录展示与通知</h2>
        <p>
          我们可能在本服务内展示你的订阅记录、续费记录与会员到期时间，以便你了解当前状态。该展示不影响支付渠道的扣费规则与取消规则。
        </p>

        <h2 className="mt-6 text-base font-bold">6. 联系我们</h2>
        <p>如需客服支持，请附上订单/扣费截图与注册邮箱并联系我们：</p>
        <ul className="list-disc pl-6 text-zinc-200">
          <li>邮箱：support@popularreels.com（示例，可按实际替换）</li>
        </ul>

        <h2 className="mt-6 text-base font-bold">7. 协议更新</h2>
        <p>我们可能会更新本协议内容。更新后协议将在本页面展示并立即生效或按页面提示生效。</p>
      </section>
    </main>
  );
}

