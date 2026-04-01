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
  postStripeCheckoutSession
} from "@/lib/client/api-fetch";
import {
  loadAppConfigClient,
  peekAppConfigCache,
  setAppConfigMemory
} from "@/lib/client/app-config-cache";

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

export function SubscriptionModal({ open, onClose, plans: plansProp }: SubscriptionModalProps) {
  const { t } = useTranslation();
  const { isLoggedIn, supabaseUserId } = useUserStore();
  const { isSubscribed } = usePlayerStore();

  // 展示用状态（初始即有缓存数据，秒开）
  const [plans, setPlans] = useState<SubscriptionPlan[]>(() => {
    if (plansProp?.length) return plansProp;
    const cached = peekAppConfigCache();
    return cached?.subscriptionPlans ?? [];
  });
  const [storeCfg, setStoreCfg] = useState<StoreConfig>(() => {
    if (plansProp?.length) return {};
    const cached = peekAppConfigCache();
    return cached?.store ?? {};
  });

  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [agreeAutoRenew, setAgreeAutoRenew] = useState(true);
  const [paying, setPaying] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  /** 后台刷新是否仍在进行中（用于切换骨架占位） */
  const [refreshing, setRefreshing] = useState(false);

  // 弹窗打开时：若外部未传 plans，立即后台刷新最新配置
  useEffect(() => {
    if (!open) return;
    if (plansProp?.length) return;

    // 立即用缓存数据展示（同步），后台再拉新数据
    setRefreshing(true);
    let cancelled = false;

    loadAppConfigClient()
      .then((json) => {
        if (cancelled) return;
        const freshPlans = json.subscriptionPlans ?? [];
        const freshStore = json.store ?? {};
        // 同步更新内存缓存，让下次打开更快
        setAppConfigMemory(json);
        setPlans(freshPlans);
        setStoreCfg(freshStore);
      })
      .catch(() => {
        /* ignore — 已有缓存兜底 */
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, plansProp]);

  // 外部传入 plans 变化时同步
  useEffect(() => {
    if (plansProp?.length) {
      setPlans(plansProp);
    }
  }, [plansProp]);

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
              {storeCfg?.title ?? t("common.subscription.title")}
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              {storeCfg?.subtitle ?? t("common.subscription.subtitle")}
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
            planGridLoading={refreshing && plans.length === 0}
            theme="dark"
          />
        </div>
      </Modal>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
