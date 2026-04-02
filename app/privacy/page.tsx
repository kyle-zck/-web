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

export default function PrivacyPage() {
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
            {isZh ? "隐私政策" : "Privacy Policy"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isZh ? "最后更新：" : "Last updated: "}2026-04-02
          </p>

          <div className="mt-6 space-y-6 text-sm leading-relaxed text-zinc-300">

            {/* Section 1 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "1. 信息收集" : "1. Information We Collect"}
              </h2>
              <p>
                {isZh
                  ? `我们收集您在使用服务时主动提供的信息，包括但不限于：账户信息（社交登录时由 OAuth 提供商提供的公开资料）、订阅记录、观影历史、搜索历史以及设备标识符（如设备 ID 或匿名会话 ID）。我们还通过第三方服务（如 Supabase）存储和管理上述数据。`
                  : `We collect information you actively provide when using our service, including but not limited to: account information (public profile provided by OAuth providers during social login), subscription records, watch history, search history, and device identifiers (such as device ID or anonymous session ID). We also store and manage the above data through third-party services (such as Supabase).`}
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "2. 信息使用目的" : "2. How We Use Your Information"}
              </h2>
              <p>
                {isZh
                  ? `我们使用收集的信息用于：(a) 提供和改进流媒体服务，包括内容推荐和观影历史记录；(b) 处理订阅和支付（通过 Stripe）；(c) 账户身份验证和安全保障；(d) 遵守法律义务；(e) 与您沟通服务相关通知。`
                  : `We use collected information to: (a) provide and improve streaming services, including content recommendations and watch history; (b) process subscriptions and payments (via Stripe); (c) authenticate accounts and ensure security; (d) comply with legal obligations; (e) communicate service-related notices with you.`}
              </p>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "3. 信息共享与披露" : "3. Information Sharing and Disclosure"}
              </h2>
              <p>
                {isZh
                  ? `我们不会出售您的个人信息。我们仅在以下情况共享数据：(a) 向支付服务商（Stripe）传输必要信息以处理订阅；(b) 向身份验证服务商（Supabase）传输必要信息以提供身份验证服务；(c) 遵守法律要求或响应政府请求；(d) 保护我们的合法权益免受侵害。`
                  : `We do not sell your personal information. We only share data in the following circumstances: (a) transmitting necessary information to payment service providers (Stripe) to process subscriptions; (b) transmitting necessary information to authentication service providers (Supabase) to provide authentication services; (c) complying with legal requirements or responding to government requests; (d) protecting our legitimate interests from harm.`}
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "4. 数据安全" : "4. Data Security"}
              </h2>
              <p>
                {isZh
                  ? `我们采用行业标准的安全措施来保护您的数据，包括加密传输（HTTPS/TLS）、访问控制和定期安全审查。然而，没有任何互联网传输或电子存储方法是完全安全的，我们无法保证数据的绝对安全。`
                  : `We employ industry-standard security measures to protect your data, including encrypted transmission (HTTPS/TLS), access controls, and regular security reviews. However, no internet transmission or electronic storage method is completely secure, and we cannot guarantee absolute data security.`}
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "5. 第三方服务" : "5. Third-Party Services"}
              </h2>
              <p>
                {isZh
                  ? `${brandName} 使用以下第三方服务：(a) Supabase（身份验证和数据库托管）；(b) Stripe（支付处理）。每个第三方服务都有其独立的隐私政策，我们建议您在使用前仔细阅读其隐私条款。`
                  : `${brandName} uses the following third-party services: (a) Supabase (authentication and database hosting); (b) Stripe (payment processing). Each third-party service has its own privacy policy, and we recommend that you carefully review their privacy terms before use.`}
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "6. 数据保留" : "6. Data Retention"}
              </h2>
              <p>
                {isZh
                  ? `我们保留您的数据直至：(a) 您的账户被删除；或 (b) 您请求删除数据；或 (c) 法律要求保留期限届满。在账户终止后，我们会在合理时间内删除或匿名化您的个人信息。`
                  : `We retain your data until: (a) your account is deleted; (b) you request data deletion; or (c) the legal retention period expires. After account termination, we will delete or anonymize your personal information within a reasonable time.`}
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "7. 您的权利" : "7. Your Rights"}
              </h2>
              <p>
                {isZh
                  ? `您对您的数据享有以下权利：(a) 访问您的个人信息；(b) 更正不准确的信息；(c) 删除您的个人信息；(d) 反对或限制某些数据处理；(e) 数据可携带权。如需行使上述权利，请通过平台内联系方式联系我们。`
                  : `You have the following rights regarding your data: (a) access to your personal information; (b) correction of inaccurate information; (c) deletion of your personal information; (d) objection to or restriction of certain data processing; (e) data portability. To exercise the above rights, please contact us through the Platform's contact methods.`}
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "8. Cookie 使用" : "8. Cookies and Tracking"}
              </h2>
              <p>
                {isZh
                  ? `我们使用必要的 Cookie 来维护会话状态和安全性。我们不将 Cookie 用于广告追踪目的。您可以在浏览器设置中禁用 Cookie，但这可能影响部分功能的正常使用。`
                  : `We use essential cookies to maintain session state and security. We do not use cookies for advertising tracking purposes. You may disable cookies in your browser settings, but this may affect the normal operation of some features.`}
              </p>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "9. 儿童隐私" : "9. Children's Privacy"}
              </h2>
              <p>
                {isZh
                  ? `我们的服务不面向 13 岁以下儿童，我们不会故意收集 13 岁以下儿童的个人信息。如发现误收集儿童个人信息，我们将立即删除相关数据。`
                  : `Our services are not directed to children under 13, and we do not knowingly collect personal information from children under 13. If we discover that personal information from children under 13 has been collected, we will delete such data immediately.`}
              </p>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "10. 政策变更" : "10. Changes to This Policy"}
              </h2>
              <p>
                {isZh
                  ? `我们可能不时更新本隐私政策。如有重大变更，我们将通过在平台内发布通知或发送电子邮件的方式告知您。在变更生效后继续使用服务即表示您接受更新后的政策。`
                  : `We may update this Privacy Policy from time to time. For significant changes, we will notify you by posting a notice on the Platform or by sending an email. Continuing to use the service after changes take effect constitutes your acceptance of the updated policy.`}
              </p>
            </section>

            {/* Section 11 */}
            <section>
              <h2 className="mb-2 text-base font-semibold text-white">
                {isZh ? "11. 联系我们" : "11. Contact Us"}
              </h2>
              <p>
                {isZh
                  ? `如您对本隐私政策有任何疑问或顾虑，请通过平台内联系方式与我们联系。`
                  : `If you have any questions or concerns about this Privacy Policy, please contact us through the Platform's contact methods.`}
              </p>
            </section>

          </div>
        </div>
      </div>
    </main>
  );
}
