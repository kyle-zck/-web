"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export default function TermsPage() {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === "zh-CN";
  const [brandName, setBrandName] = useState("ReelShorts");

  useEffect(() => {
    fetch("/api/app-config", { cache: "no-store" })
      .then((r) => r.json())
      .then((c: any) => {
        if (c?.brandName) setBrandName(c.brandName);
      })
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-black px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        {/* Back */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-400 transition-colors hover:text-white"
        >
          <BackIcon />
          {t("common.backHome")}
        </Link>

        <div className="rounded-3xl border border-zinc-800/60 bg-zinc-950/80 p-6 sm:p-8 backdrop-blur-sm">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            {isZh ? "服务协议" : "Terms of Service"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isZh ? "最后更新：" : "Last updated: "}2026-04-02
          </p>

          <div className="mt-6 space-y-6 text-sm leading-relaxed text-zinc-300">

            {/* Section 1 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "1. 协议接受" : "1. Acceptance of Terms"}
              </h2>
              <p>
                {isZh
                  ? `欢迎使用 ${brandName}（以下简称"我们"或"平台"）。在使用我们的服务之前，请仔细阅读本服务协议（以下简称"协议"）。您通过访问或使用本平台，即表示您同意受本协议的约束。如果您不同意本协议的任何部分，请勿使用本平台。`
                  : `Welcome to ${brandName} ("we", "us", or "Platform"). Before using our service, please read these Terms of Service ("Agreement") carefully. By accessing or using our Platform, you agree to be bound by this Agreement. If you do not agree to any part of this Agreement, please do not use the Platform.`}
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "2. 服务描述" : "2. Description of Service"}
              </h2>
              <p>
                {isZh
                  ? `${brandName} 提供短剧流媒体内容服务，包括但不限于视频点播、订阅管理及相关功能。我们保留随时修改、暂停或终止服务（或其任何部分）的权利，恕不另行通知。`
                  : `${brandName} provides short drama streaming content services, including but not limited to video on demand, subscription management, and related features. We reserve the right to modify, suspend, or discontinue the service (or any part thereof) at any time without prior notice.`}
              </p>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "3. 账户注册与安全" : "3. Account Registration and Security"}
              </h2>
              <p>
                {isZh
                  ? `您可能需要创建一个账户才能访问某些功能。您同意提供准确、完整的信息，并保持账户信息的更新。您对账户下的所有活动负全部责任，并同意对账户凭证保密。如发现任何未经授权使用您账户的行为，应立即通知我们。`
                  : `You may need to create an account to access certain features. You agree to provide accurate, complete information and keep your account details up to date. You are solely responsible for all activities under your account and agree to keep your account credentials confidential. If you discover any unauthorized use of your account, you must notify us immediately.`}
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "4. 订阅与付款" : "4. Subscriptions and Payments"}
              </h2>
              <p>
                {isZh
                  ? `${brandName} 提供付费订阅服务。订阅为自动续订，直至您取消。取消可在任何时间进行，取消后您仍可在当前计费周期结束前享受服务。付费后不支持退款，除非法律另有规定。所有订阅价格以美元计价，如有调整我们将提前通知。充值天数与套餐天数等值；充值不支持退款。`
                  : `${brandName} offers paid subscription services. Subscriptions renew automatically until you cancel. Cancellation may be done at any time; after cancellation, you may continue to enjoy the service until the end of the current billing period. Refunds are not supported after payment, unless otherwise required by law. All subscription prices are in USD; we will notify you in advance of any price adjustments. Recharge days are equal to plan days; recharge does not support refunds.`}
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "5. 内容与知识产权" : "5. Content and Intellectual Property"}
              </h2>
              <p>
                {isZh
                  ? `本平台及所有相关内容（包括但不限于视频、文本、图形、标识和软件）的知识产权归我们或我们的内容提供商所有，受适用法律保护。未经明确授权，禁止复制、分发、创建衍生作品或公开展示任何内容。`
                  : `The intellectual property rights in the Platform and all related content (including but not limited to videos, text, graphics, logos, and software) belong to us or our content providers and are protected by applicable laws. Copying, distributing, creating derivative works, or publicly displaying any content without express authorization is prohibited.`}
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "6. 用户行为规范" : "6. User Conduct"}
              </h2>
              <p>
                {isZh
                  ? `您同意不会：(a) 使用本服务从事任何非法活动；(b) 尝试未经授权访问其他用户账户或系统；(c) 上传或传播任何含有病毒、恶意代码或有害内容的材料；(d) 干扰或破坏本服务的正常运行；(e) 抓取、收集或提取本平台数据。违反上述规范可能导致账户被终止。`
                  : `You agree not to: (a) use the service for any illegal activities; (b) attempt unauthorized access to other user accounts or systems; (c) upload or distribute any material containing viruses, malicious code, or harmful content; (d) interfere with or disrupt the normal operation of the service; (e) scrape, collect, or extract data from the Platform. Violation of these guidelines may result in account termination.`}
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "7. 免责声明与责任限制" : "7. Disclaimer and Limitation of Liability"}
              </h2>
              <p>
                {isZh
                  ? `本服务按"现状"提供，不提供任何明示或暗示的保证。在法律允许的最大范围内，我们不对任何间接、附带、特殊或后果性损害承担责任。我们对您的总赔偿责任不超过您为相关服务支付的金额（如有）。`
                  : `The service is provided "as is" without any express or implied warranties. To the fullest extent permitted by law, we shall not be liable for any indirect, incidental, special, or consequential damages. Our total liability to you shall not exceed the amount you paid for the relevant service (if any).`}
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "8. 服务变更与终止" : "8. Changes and Termination"}
              </h2>
              <p>
                {isZh
                  ? `我们保留随时修改或停止服务的权利，恕不另行通知。我们也可以在无需理由的情况下终止您的账户。一旦终止，您的订阅权益将立即停止。我们不对因服务终止而造成的任何损失负责。`
                  : `We reserve the right to modify or discontinue the service at any time without prior notice. We may also terminate your account without reason. Upon termination, your subscription benefits will cease immediately. We are not responsible for any losses caused by service termination.`}
              </p>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "9. 适用法律与争议解决" : "9. Governing Law and Dispute Resolution"}
              </h2>
              <p>
                {isZh
                  ? `本协议受开曼群岛法律管辖并按其解释。因本协议引起的任何争议，将在有管辖权的法院进行管辖。我们均确认，本协议不赋予任何第三方受益权利。`
                  : `This Agreement shall be governed by and construed in accordance with the laws of the Cayman Islands. Any dispute arising from this Agreement shall be subject to the jurisdiction of the competent courts. Both parties acknowledge that this Agreement does not confer any third-party beneficiary rights.`}
              </p>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "10. 联系我们" : "10. Contact Us"}
              </h2>
              <p>
                {isZh
                  ? `如您对本协议有任何疑问，请通过平台内联系方式与我们联系。`
                  : `If you have any questions about this Agreement, please contact us through the Platform's contact methods.`}
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
