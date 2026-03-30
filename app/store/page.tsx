"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthModal } from "@/components/ui/auth-modal";
import { usePlayerStore } from "@/lib/store/player";
import { useUserStore } from "@/lib/store/user";
import { useTranslation } from "react-i18next";
import type { SubscriptionPlan } from "@/constants/mock-data";
import { cn } from "@/lib/utils";
import { getOrCreateDeviceClientId } from "@/lib/client/device-client-id";
import {
  checkoutResultToUserMessage,
  fetchJsonWithTimeout,
  postStripeCheckoutSession
} from "@/lib/client/api-fetch";

function formatUsd(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(price);
}

type StoreConfig = {
  store?: {
    title?: string;
    subtitle?: string;
    tips?: string[];
  };
  subscriptionPlans?: SubscriptionPlan[];
};

function clampDiscountPercent(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 100;
  return Math.max(1, Math.min(100, Math.round(n)));
}

function effectivePriceUsd(plan: SubscriptionPlan): number {
  const dp = clampDiscountPercent(plan.discountPercent ?? 100);
  if (dp >= 100) return plan.priceUsd;
  return Math.round((plan.priceUsd * dp / 100) * 100) / 100;
}

function discountEndMs(plan: SubscriptionPlan): number | null {
  const dp = clampDiscountPercent(plan.discountPercent ?? 100);
  const days = typeof plan.discountDays === "number" ? plan.discountDays : Number(plan.discountDays ?? 0);
  if (dp >= 100) return null;
  if (!Number.isFinite(days) || days <= 0) return null;
  const start = plan.discountStartAt ? new Date(plan.discountStartAt).getTime() : NaN;
  if (!Number.isFinite(start)) return null;
  return start + Math.floor(days) * 24 * 60 * 60 * 1000;
}

function formatCountdown(ms: number, t: (key: string, opts?: any) => string): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const dd = String(d);
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const sss = String(ss).padStart(2, "0");
  return `${dd}${t("countdown.day", "d")} ${hh}${t("countdown.hour", "h")} ${mm}${t("countdown.min", "m")} ${sss}${t("countdown.sec", "s")}`;
}

export default function StorePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isSubscribed } = usePlayerStore();
  const { isLoggedIn, supabaseUserId } = useUserStore();

  const [authOpen, setAuthOpen] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [storeCfg, setStoreCfg] = useState<StoreConfig["store"]>({});
  const [paying, setPaying] = useState(false);
  const [agreeAutoRenew, setAgreeAutoRenew] = useState(true);
  const [payResult, setPayResult] = useState<null | "success" | "cancel">(null);

  const payResultTitle = useMemo(() => {
    if (payResult === "success") return t("store.paySuccessTitle", "Payment Successful");
    if (payResult === "cancel") return t("store.payCancelTitle", "Payment Cancelled");
    return "";
  }, [payResult, t]);

  const payResultDesc = useMemo(() => {
    if (payResult === "success") {
      return t(
        "store.paySuccessDesc",
        "Your payment has been completed. Close this dialog to start a new payment if needed."
      );
    }
    if (payResult === "cancel") {
      return t(
        "store.payCancelDesc",
        "You have cancelled this payment. You can select a plan and try again."
      );
    }
    return "";
  }, [payResult, t]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchJsonWithTimeout<StoreConfig>("/api/app-config", 8000, ctrl.signal)
      .then((json: StoreConfig) => {
        setPlans(json.subscriptionPlans ?? []);
        setStoreCfg(json.store ?? {});
      })
      .catch(() => {
        setPlans([]);
        setStoreCfg({});
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const pay = (url.searchParams.get("pay") ?? "").trim();
    if (pay === "success") setPayResult("success");
    else if (pay === "cancel") setPayResult("cancel");
    else return;
  }, []);

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!isLoggedIn) {
      setAuthOpen(true);
      return;
    }
    const clientId = supabaseUserId ?? getOrCreateDeviceClientId();
    if (!clientId) return;
    setPaying(true);
    try {
      const result = await postStripeCheckoutSession({ clientId, planId: plan.id });
      if (!result.ok) {
        window.alert(checkoutResultToUserMessage(result, t));
        return;
      }
      window.location.href = result.url;
    } finally {
      setPaying(false);
    }
  };

  const handlePayNow = async () => {
    if (selectedPlan) {
      await handleSubscribe(selectedPlan);
    }
  };

  const closePayResult = () => {
    setPayResult(null);
    setPaying(false);
    setSelectedPlan(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("pay");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    } else {
      router.replace("/store");
    }
  };

  return (
    <main className="flex min-h-screen flex-col">
      <header className="page-gutter-x pt-4">
        <div>
          <h1 className="section-title-fluid font-bold text-zinc-100">
            {storeCfg?.title ?? t("subscription.title", "VIP Unlock all series for free")}
          </h1>
          <p className="text-body-fluid mt-1 text-zinc-500">
            {storeCfg?.subtitle ?? t("subscription.subtitle", "Auto renew. Cancel anytime.")}
          </p>
        </div>
        {isSubscribed && (
          <div className="mt-3 rounded-xl bg-green-500/20 px-4 py-2 text-sm font-semibold text-green-300">
            {t("subscription.active", "You are a VIP member. All episodes unlocked.")}
          </div>
        )}
      </header>

      <div className="page-gutter-x flex-1 pb-24 pt-6 sm:pb-28">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlan(plan)}
              onDoubleClick={() => {
                setSelectedPlan(plan);
                void handleSubscribe(plan);
              }}
              className={cn(
                "relative overflow-hidden rounded-2xl p-5 text-left shadow-lg transition-all",
                "bg-gradient-to-br from-amber-100 to-amber-200/90",
                selectedPlan?.id === plan.id && "ring-2 ring-brand",
                "hover:scale-[1.02]"
              )}
            >
              {(() => {
                const dp = clampDiscountPercent(plan.discountPercent ?? 100);
                const end = discountEndMs(plan);
                if (dp >= 100) return null;
                const now = Date.now();
                const remaining = end ? end - now : null;
                const countdown = remaining != null ? formatCountdown(remaining, t) : null;
                return (
                  <div className="absolute right-4 top-4 z-10">
                    <div className="rounded-xl bg-red-600 px-4 py-3 text-white shadow-lg ring-1 ring-red-300/40">
                      <div className="text-lg font-extrabold leading-none">
                        <span className="mr-2">{dp}%</span>
                        <span className="mr-2">OFF</span>
                        <span>{t("subscription.limitedTime", "Limited")}</span>
                      </div>
                    </div>
                    {countdown ? (
                      <div className="mt-1 text-sm font-bold tabular-nums text-black">
                        ⏱ {countdown}
                      </div>
                    ) : null}
                  </div>
                );
              })()}
              <span
                className="absolute -right-4 -top-4 text-[120px] font-black leading-none text-amber-300/30"
                aria-hidden
              >
                V
              </span>
              <div className="relative">
                <p className="text-sm font-semibold text-amber-900">{plan.label}</p>
                {(() => {
                  const dp = clampDiscountPercent(plan.discountPercent ?? 100);
                  const paid = effectivePriceUsd(plan);
                  if (dp >= 100) {
                    return (
                      <p className="mt-2 text-2xl font-bold text-amber-950">
                        {formatUsd(plan.priceUsd)}
                      </p>
                    );
                  }
                  return (
                    <div className="mt-2 flex items-end gap-2">
                      <p className="text-2xl font-bold text-amber-950">{formatUsd(paid)}</p>
                      <p className="text-sm font-semibold text-amber-800/70 line-through">
                        {formatUsd(plan.priceUsd)}
                      </p>
                    </div>
                  );
                })()}
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

        <section className="mt-8 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <div className="rounded-xl bg-black/30 p-4">
            <p className="text-xs font-semibold text-zinc-400">
              {t("store.tips", "Tips:")}
            </p>
            <ol className="mt-2 space-y-1 text-xs leading-5 text-zinc-500">
              {(storeCfg?.tips?.length ? storeCfg.tips : [
                t("store.tip1", "Free and paid content available. You decide which to unlock."),
                t("store.tip2", "VIP subscription unlocks all paid content."),
                t("store.tip3", "Refill and countdown days are equal value. Recharge does not support refund."),
                t("store.tip4", "Contact us if you have other problems.")
              ]).map((line, idx) => (
                <li key={idx}>
                  {idx + 1}. {line}
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-4">
            <label className="flex cursor-pointer items-start gap-3 text-[10px] text-zinc-400">
              <input
                type="checkbox"
                checked={agreeAutoRenew}
                onChange={(e) => setAgreeAutoRenew(e.target.checked)}
                className="mt-1 h-4 w-4 accent-red-500"
              />
              <span className="leading-4">
                {t("subscription.agreeTermsPrefix", "I have read and agree to the")}
                <a
                  href="/legal/subscription-terms"
                  target="_blank"
                  rel="noreferrer"
                  className="mx-1 font-semibold text-brand/90 underline underline-offset-4"
                >
                  {t("subscription.autoRenewTerms", "Auto-renewal & Premium Services Agreement")}
                </a>
                {t("subscription.agreeTermsSuffix", ", and understand that auto-renewal is enabled by default. To cancel, please cancel in your payment channel.")}
              </span>
            </label>
          </div>

          <button
            type="button"
            onClick={handlePayNow}
            disabled={!selectedPlan || paying || !agreeAutoRenew}
            className={cn(
              "mt-4 w-full rounded-xl px-4 py-3.5 text-base font-bold text-white transition-colors",
              "bg-brand shadow-soft-glow hover:bg-red-600",
              (!selectedPlan || paying || !agreeAutoRenew) && "cursor-not-allowed opacity-60"
            )}
          >
            {paying ? t("auth.working", "Processing...") : t("store.payNow", "Pay Now")}
          </button>
        </section>
      </div>

      {payResult ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-zinc-100">{payResultTitle}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{payResultDesc}</p>
              </div>
              <button
                type="button"
                onClick={closePayResult}
                className="rounded-lg border border-zinc-700 bg-black/40 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-900/60"
              >
                {t("admin.close", "Close")}
              </button>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closePayResult}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                {t("store.continue", "Continue")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </main>
  );
}
