"use client";

import { useEffect, useState } from "react";
import type { SubscriptionPlan } from "@/constants/mock-data";
import { Modal } from "@/components/ui/modal";
import { SubscriptionPlanSection } from "@/components/recharge/subscription-plan-section";
import { useUserStore } from "@/lib/store/user";
import { usePlayerStore } from "@/lib/store/player";
import { getOrCreateDeviceClientId } from "@/lib/client/device-client-id";
import { AuthModal } from "@/components/ui/auth-modal";
import { useTranslation } from "react-i18next";
import {
  checkoutResultToUserMessage,
  fetchJsonWithTimeout,
  postStripeCheckoutSession
} from "@/lib/client/api-fetch";

interface SubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  plans?: SubscriptionPlan[];
}

type StoreConfig = {
  title?: string;
  subtitle?: string;
  tips?: string[];
};

type AppConfigResponse = {
  subscriptionPlans?: SubscriptionPlan[];
  store?: StoreConfig;
};

export function SubscriptionModal({ open, onClose, plans: plansProp }: SubscriptionModalProps) {
  const { t } = useTranslation();
  const { isLoggedIn, supabaseUserId } = useUserStore();
  const { isSubscribed } = usePlayerStore();

  const [plans, setPlans] = useState<SubscriptionPlan[]>(plansProp ?? []);
  const [storeCfg, setStoreCfg] = useState<StoreConfig>({});
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [agreeAutoRenew, setAgreeAutoRenew] = useState(true);
  const [paying, setPaying] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (plansProp?.length) {
      setPlans(plansProp);
    } else {
      const ctrl = new AbortController();
      fetchJsonWithTimeout<AppConfigResponse>("/api/app-config", 8000, ctrl.signal)
        .then((json) => {
          setPlans(json.subscriptionPlans ?? []);
          setStoreCfg(json.store ?? {});
        })
        .catch(() => {
          setPlans([]);
          setStoreCfg({});
        });
      return () => ctrl.abort();
    }
  }, [open, plansProp]);

  useEffect(() => {
    if (!open || plansProp?.length) return;
    const ctrl = new AbortController();
    fetchJsonWithTimeout<{ store?: StoreConfig }>("/api/app-config", 8000, ctrl.signal)
      .then((json) => setStoreCfg(json.store ?? {}))
      .catch(() => setStoreCfg({}));
    return () => ctrl.abort();
  }, [open, plansProp]);

  const handlePayNow = async () => {
    if (!selectedPlan) return;
    if (!agreeAutoRenew) return;

    if (!isLoggedIn) {
      setAuthOpen(true);
      return;
    }

    const clientId = supabaseUserId ?? getOrCreateDeviceClientId();
    if (!clientId) return;

    setPaying(true);
    try {
      const result = await postStripeCheckoutSession({ clientId, planId: selectedPlan.id });
      if (!result.ok) {
        window.alert(checkoutResultToUserMessage(result, t));
        return;
      }
      window.location.href = result.url;
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="" footer={null}>
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-white">
              {storeCfg?.title ?? t("subscription.title", "VIP Unlock all series for free")}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {storeCfg?.subtitle ?? t("subscription.subtitle", "Auto renew. Cancel anytime.")}
            </p>
          </div>

          <SubscriptionPlanSection
            plans={plans}
            storeCfg={storeCfg}
            selectedPlan={selectedPlan}
            onSelectPlan={(plan) => setSelectedPlan(plan)}
            agreeAutoRenew={agreeAutoRenew}
            onAgreeAutoRenewChange={setAgreeAutoRenew}
            onPayNow={handlePayNow}
            paying={paying}
            isSubscribed={isSubscribed}
            gridCols={2}
          />
        </div>
      </Modal>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
