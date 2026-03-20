"use client";

import { useEffect, useState } from "react";
import { AuthModal } from "@/components/ui/auth-modal";
import { usePlayerStore } from "@/lib/store/player";
import { useUserStore } from "@/lib/store/user";
import { useTranslation } from "react-i18next";
import type { SubscriptionPlan } from "@/constants/mock-data";
import { cn } from "@/lib/utils";

function formatUsd(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(price);
}

const PAYMENT_METHODS = [
  { id: "paypal", label: "PayPal", icon: "PP" },
  { id: "card", label: "Credit/Debit", icon: "💳" },
  { id: "generic", label: "Card", icon: "💳" },
  { id: "gpay", label: "Google Pay", icon: "G" }
] as const;

export default function StorePage() {
  const { t } = useTranslation();
  const { isSubscribed, setSubscribed } = usePlayerStore();
  const { isLoggedIn, userId } = useUserStore();

  const [authOpen, setAuthOpen] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("paypal");

  useEffect(() => {
    fetch("/api/app-config")
      .then((r) => r.json())
      .then((json) => setPlans(json.subscriptionPlans ?? []))
      .catch(() => setPlans([]));
  }, []);

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!isLoggedIn) {
      setAuthOpen(true);
      return;
    }
    if (plan.paymentUrl && !plan.paymentUrl.startsWith("/store")) {
      window.location.href = plan.paymentUrl;
    } else {
      setSubscribed(true, plan.durationDays, plan.label);
      if (userId) {
        try {
          await fetch("/api/user/recharge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clientId: userId,
              price: plan.priceUsd,
              tier: plan.label
            })
          });
        } catch {
          // ignore
        }
      }
    }
  };

  const handlePayNow = async () => {
    if (selectedPlan) {
      await handleSubscribe(selectedPlan);
    }
  };

  return (
    <main className="flex min-h-screen flex-col">
      <header className="px-4 pt-4 sm:px-6 lg:px-10">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">
            {t("subscription.title", "VIP Unlock all series for free")}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t("subscription.subtitle", "Auto renew. Cancel anytime.")}
          </p>
        </div>
        {isSubscribed && (
          <div className="mt-3 rounded-xl bg-green-500/20 px-4 py-2 text-sm font-semibold text-green-300">
            {t("subscription.active", "You are a VIP member. All episodes unlocked.")}
          </div>
        )}
      </header>

      <div className="flex-1 px-4 pb-24 pt-6 sm:px-6 sm:pb-28 lg:px-10">
        {/* VIP 套餐卡片 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlan(plan)}
              disabled={isSubscribed}
              className={cn(
                "relative overflow-hidden rounded-2xl p-5 text-left shadow-lg transition-all",
                "bg-gradient-to-br from-amber-100 to-amber-200/90",
                selectedPlan?.id === plan.id && "ring-2 ring-brand",
                isSubscribed && "opacity-60 cursor-not-allowed",
                !isSubscribed && "hover:scale-[1.02]"
              )}
            >
              <span
                className="absolute -right-4 -top-4 text-[120px] font-black leading-none text-amber-300/30"
                aria-hidden
              >
                V
              </span>
              <div className="relative">
                <p className="text-sm font-semibold text-amber-900">{plan.label}</p>
                <p className="mt-2 text-2xl font-bold text-amber-950">
                  {formatUsd(plan.priceUsd)}
                </p>
                <p className="mt-1 text-xs text-amber-800/80">
                  {t("subscription.autoRenew", "Auto-renew. Cancel anytime.")}
                </p>
                <div className="mt-4 flex flex-wrap gap-3 border-t border-amber-300/50 pt-3">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
                    <span aria-hidden>📺</span>
                    {t("subscription.unlimited", "Unlimited Viewing")}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-amber-900">
                    <span className="rounded bg-amber-900/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">
                      1080
                    </span>
                    {t("subscription.hd", "1080p High Quality")}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* 支付方式（图2 样式） */}
        <section className="mt-8 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <h2 className="text-base font-bold text-zinc-100">
            {t("store.paymentMethods", "Payment Methods")}
          </h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.id}
                type="button"
                onClick={() => setPaymentMethod(pm.id)}
                className={cn(
                  "flex min-w-[100px] flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors",
                  paymentMethod === pm.id
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-zinc-700/80 bg-zinc-900/50 text-zinc-300 hover:border-zinc-600"
                )}
              >
                <span className="text-lg">{pm.icon}</span>
                {pm.label}
              </button>
            ))}
          </div>

          {/* Tips */}
          <div className="mt-4 rounded-xl bg-black/30 p-4">
            <p className="text-xs font-semibold text-zinc-400">
              {t("store.tips", "Tips:")}
            </p>
            <ol className="mt-2 space-y-1 text-xs leading-5 text-zinc-500">
              <li>1. {t("store.tip1", "Free and paid content available. You decide which to unlock.")}</li>
              <li>2. {t("store.tip2", "VIP subscription unlocks all paid content.")}</li>
              <li>3. {t("store.tip3", "Refill and countdown days are equal value. Recharge does not support refund.")}</li>
              <li>4. {t("store.tip4", "Contact us if you have other problems.")}</li>
            </ol>
          </div>

          {/* Pay Now */}
          <button
            type="button"
            onClick={handlePayNow}
            disabled={!selectedPlan || isSubscribed}
            className={cn(
              "mt-4 w-full rounded-xl px-4 py-3.5 text-base font-bold text-white transition-colors",
              "bg-brand shadow-soft-glow hover:bg-red-600",
              (!selectedPlan || isSubscribed) && "cursor-not-allowed opacity-60"
            )}
          >
            {t("store.payNow", "Pay Now")}
          </button>
        </section>

        <p className="mt-4 text-center text-xs text-zinc-500">
          {t("store.demoHint", "Demo: Select a plan and click Pay Now to unlock.")}
        </p>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}
