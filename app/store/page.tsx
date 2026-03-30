"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthModal } from "@/components/ui/auth-modal";
import { usePlayerStore } from "@/lib/store/player";
import { useUserStore } from "@/lib/store/user";
import { useTranslation } from "react-i18next";
import type { SubscriptionPlan } from "@/constants/mock-data";
import { SubscriptionPlanSection } from "@/components/recharge/subscription-plan-section";
import { getOrCreateDeviceClientId } from "@/lib/client/device-client-id";
import {
  checkoutResultToUserMessage,
  fetchJsonWithTimeout,
  postStripeCheckoutSession
} from "@/lib/client/api-fetch";

type StoreConfig = {
  store?: {
    title?: string;
    subtitle?: string;
    tips?: string[];
  };
  subscriptionPlans?: SubscriptionPlan[];
};

export default function StorePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isSubscribed } = usePlayerStore();
  const { isLoggedIn, supabaseUserId } = useUserStore();

  const [authOpen, setAuthOpen] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [storeCfg, setStoreCfg] = useState<StoreConfig["store"]>({});
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [agreeAutoRenew, setAgreeAutoRenew] = useState(true);
  const [paying, setPaying] = useState(false);
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
      </header>

      <div className="page-gutter-x flex-1 pb-24 pt-6 sm:pb-28">
        <SubscriptionPlanSection
          plans={plans}
          storeCfg={storeCfg}
          selectedPlan={selectedPlan}
          onSelectPlan={(plan) => {
            setSelectedPlan(plan);
          }}
          onPayNow={handlePayNow}
          agreeAutoRenew={agreeAutoRenew}
          onAgreeAutoRenewChange={setAgreeAutoRenew}
          paying={paying}
          isSubscribed={isSubscribed}
          gridCols={3}
        />
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
                {t("common.close", "Close")}
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
