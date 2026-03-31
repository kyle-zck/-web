"use client";

import type { SubscriptionPlan } from "@/constants/mock-data";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

type StoreConfig = {
  title?: string;
  subtitle?: string;
  tips?: string[];
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

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(n);
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

export interface SubscriptionPlanSectionProps {
  plans: SubscriptionPlan[];
  storeCfg?: StoreConfig;
  selectedPlan: SubscriptionPlan | null;
  onSelectPlan: (plan: SubscriptionPlan) => void;
  agreeAutoRenew: boolean;
  onAgreeAutoRenewChange: (v: boolean) => void;
  onPayNow: () => void;
  paying: boolean;
  isSubscribed?: boolean;
  gridCols?: 1 | 2 | 3;
  /** 配置拉取中且无套餐数据时显示骨架，避免空白闪烁 */
  planGridLoading?: boolean;
  /** "dark" 用于 Modal 覆盖层（手机端深色背景）；"light" 用于 Store 页面（琥珀色全页主题） */
  theme?: "dark" | "light";
}

export function SubscriptionPlanSection({
  plans,
  storeCfg,
  selectedPlan,
  onSelectPlan,
  agreeAutoRenew,
  onAgreeAutoRenewChange,
  onPayNow,
  paying,
  isSubscribed,
  gridCols = 3,
  planGridLoading = false,
  theme = "dark"
}: SubscriptionPlanSectionProps) {
  const { t } = useTranslation();
  const isDark = theme === "dark";

  const gridColsClass =
    gridCols === 1
      ? "grid-cols-1"
      : gridCols === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  const defaultTips = [
    t("store.tip1", "Free and paid content available. You decide which to unlock."),
    t("store.tip2", "VIP subscription unlocks all paid content."),
    t("store.tip3", "Refill and countdown days are equal value. Recharge does not support refund."),
    t("store.tip4", "Contact us if you have other problems.")
  ];

  return (
    <>
      {isSubscribed && (
        <div className="rounded-xl bg-green-500/20 px-4 py-2 text-sm font-semibold text-green-300">
          {t("subscription.active", "You are a VIP member. All episodes unlocked.")}
        </div>
      )}

      <div className={cn("grid gap-4", gridColsClass)}>
        {planGridLoading ? (
          <>
            <div className="h-48 animate-pulse rounded-2xl bg-zinc-800/80" aria-hidden />
            <div className="h-48 animate-pulse rounded-2xl bg-zinc-800/80" aria-hidden />
          </>
        ) : null}
        {!planGridLoading &&
          plans.map((plan) => {
            const isSelected = selectedPlan?.id === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => onSelectPlan(plan)}
                className={cn(
                  "relative overflow-hidden rounded-2xl p-5 text-left shadow-lg transition-all",
                  isDark
                    ? isSelected
                      ? "bg-gradient-to-br from-red-700/80 to-red-900/80 ring-2 ring-brand"
                      : "bg-gradient-to-br from-zinc-800/80 to-zinc-900/80 hover:from-zinc-700/80 hover:to-zinc-800/80"
                    : isSelected
                      ? "bg-gradient-to-br from-amber-100 to-amber-200/90 ring-2 ring-brand"
                      : "bg-gradient-to-br from-amber-100 to-amber-200/90",
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
                        <div
                          className={cn(
                            "mt-1 text-sm font-bold tabular-nums",
                            isDark ? "text-zinc-300" : "text-black"
                          )}
                        >
                          ⏱ {countdown}
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
                <span
                  className={cn(
                    "absolute -right-4 -top-4 text-[120px] font-black leading-none",
                    isDark
                      ? isSelected
                        ? "text-red-500/20"
                        : "text-zinc-700/40"
                      : "text-amber-300/30"
                  )}
                  aria-hidden
                >
                  V
                </span>
                <div className="relative">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      isDark
                        ? isSelected
                          ? "text-red-200"
                          : "text-zinc-300"
                        : "text-amber-900"
                    )}
                  >
                    {plan.label}
                  </p>
                  {(() => {
                    const dp = clampDiscountPercent(plan.discountPercent ?? 100);
                    const paid = effectivePriceUsd(plan);
                    if (dp >= 100) {
                      return (
                        <p
                          className={cn(
                            "mt-2 text-2xl font-bold",
                            isDark
                              ? isSelected
                                ? "text-white"
                                : "text-zinc-100"
                              : "text-amber-950"
                          )}
                        >
                          {formatUsd(plan.priceUsd)}
                        </p>
                      );
                    }
                    return (
                      <div className="mt-2 flex items-end gap-2">
                        <p
                          className={cn(
                            "text-2xl font-bold",
                            isDark
                              ? isSelected
                                ? "text-white"
                                : "text-zinc-100"
                              : "text-amber-950"
                          )}
                        >
                          {formatUsd(paid)}
                        </p>
                        <p
                          className={cn(
                            "text-sm font-semibold line-through",
                            isDark
                              ? isSelected
                                ? "text-red-300/60"
                                : "text-zinc-500"
                              : "text-amber-800/70"
                          )}
                        >
                          {formatUsd(plan.priceUsd)}
                        </p>
                      </div>
                    );
                  })()}
                  <p
                    className={cn(
                      "mt-1 text-xs",
                      isDark ? (isSelected ? "text-red-200/70" : "text-zinc-500") : "text-amber-800/80"
                    )}
                  >
                    {t("subscription.autoRenew", "Auto-renew. Cancel anytime.")}
                  </p>
                  <div
                    className={cn(
                      "mt-4 flex flex-wrap gap-3 border-t pt-3",
                      isDark
                        ? "border-zinc-700/50"
                        : "border-amber-300/50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-medium",
                        isDark
                          ? isSelected
                            ? "text-red-200"
                            : "text-zinc-400"
                          : "text-amber-900"
                      )}
                    >
                      <span aria-hidden>📺</span>
                      {t("subscription.unlimited", "Unlimited Viewing")}
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-xs font-medium",
                        isDark
                          ? isSelected
                            ? "text-red-200"
                            : "text-zinc-400"
                          : "text-amber-900"
                      )}
                    >
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-bold",
                          isDark
                            ? isSelected
                              ? "bg-red-600/40 text-red-200"
                              : "bg-zinc-700 text-zinc-300"
                            : "bg-amber-900/20 text-amber-900"
                        )}
                      >
                        1080
                      </span>
                      {t("subscription.hd", "1080p High Quality")}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
      </div>

      <section className="mt-8 rounded-2xl border p-4 bg-zinc-900/60">
        <div className="rounded-xl bg-black/30 p-4">
          <p className="text-xs font-semibold text-zinc-400">
            {t("store.tips", "Tips:")}
          </p>
          <ol className="mt-2 space-y-1 text-xs leading-5 text-zinc-500">
            {(storeCfg?.tips?.length ? storeCfg.tips : defaultTips).map((line, idx) => (
              <li key={idx}>
                {idx + 1}. {line}
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-800/80 bg-black/30 p-4">
          <label className="flex cursor-pointer items-start gap-3 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={agreeAutoRenew}
              onChange={(e) => onAgreeAutoRenewChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
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
          onClick={onPayNow}
          disabled={!selectedPlan || paying || !agreeAutoRenew}
          className={cn(
            "mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-bold text-white transition-colors",
            "bg-brand shadow-soft-glow hover:bg-red-600",
            (!selectedPlan || paying || !agreeAutoRenew) && "cursor-not-allowed opacity-60"
          )}
        >
          {paying ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
              {t("auth.working", "Processing...")}
            </>
          ) : (
            t("store.payNow", "Pay Now")
          )}
        </button>
      </section>
    </>
  );
}
