"use client";

import { useTranslation } from "react-i18next";
import type { SubscriptionPlan } from "@/constants/mock-data";
import { Modal } from "@/components/ui/modal";

interface SubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  plans: SubscriptionPlan[];
}

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(n);
}

export function SubscriptionModal({ open, onClose, plans }: SubscriptionModalProps) {
  const { t } = useTranslation();

  const handleSelect = (plan: SubscriptionPlan) => {
    if (plan.paymentUrl) {
      window.location.href = plan.paymentUrl;
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="" footer={null}>
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white">
            {t("subscription.title", "VIP Unlock all series for free")}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            {t("subscription.subtitle", "Auto renew. Cancel anytime.")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => handleSelect(plan)}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200/90 p-5 text-left shadow-lg transition-transform hover:scale-[1.02]"
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
      </div>
    </Modal>
  );
}
