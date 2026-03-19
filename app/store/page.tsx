"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AuthModal } from "@/components/ui/auth-modal";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { usePlayerStore } from "@/lib/store/player";
import { useUserStore } from "@/lib/store/user";
import { useTranslation } from "react-i18next";

type CoinPackage = {
  id: string;
  priceUsd: number;
  coins: number;
  bestValue?: boolean;
};

const PACKAGES: CoinPackage[] = [
  { id: "p1", priceUsd: 4.99, coins: 200 },
  { id: "p2", priceUsd: 9.99, coins: 500, bestValue: true },
  { id: "p3", priceUsd: 19.99, coins: 1200 },
  { id: "p4", priceUsd: 49.99, coins: 3500 }
];

function formatUsd(price: number) {
  return `$${price.toFixed(2)}`;
}

export default function StorePage() {
  const { t } = useTranslation();
  const { coinBalance } = usePlayerStore();
  const { isLoggedIn } = useUserStore();

  const [authOpen, setAuthOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [activePackage, setActivePackage] = useState<CoinPackage | null>(null);
  const [provider, setProvider] = useState<"stripe" | "paypal" | null>(null);

  const bestValue = useMemo(() => PACKAGES.find((p) => p.bestValue) ?? PACKAGES[0], []);

  const providerLabel =
    provider === "stripe"
      ? "Stripe"
      : provider === "paypal"
        ? "PayPal"
        : "";

  const openCheckout = (pkg: CoinPackage) => {
    if (!isLoggedIn) {
      setAuthOpen(true);
      return;
    }
    setActivePackage(pkg);
    setCheckoutOpen(true);
    setProvider(null);
  };

  return (
    <main className="flex min-h-screen flex-col">
      <header className="px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-zinc-100">
              {t("store.title")}
            </h1>
            <p className="mt-1 text-xs text-zinc-400">{t("store.rechargeHint")}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-zinc-400">
              {t("store.currentBalance")}
            </p>
            <p className="mt-1 text-xl font-extrabold text-white">
              {coinBalance}
              <span className="ml-1 text-sm font-bold text-zinc-400">
                {t("profile.coins")}
              </span>
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 pb-24 pt-3">
        <section className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-zinc-400">
                {t("store.bestValue")}
              </p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">
                {formatUsd(bestValue.priceUsd)} · {bestValue.coins}{" "}
                {t("store.coinsLabel")}
              </p>
            </div>
            <Badge
              variant="pill"
              className="bg-brand/15 text-brand ring-1 ring-brand/40"
            >
              {t("store.best")}
            </Badge>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-zinc-500">
            {t("store.demoOnlyHint")}
          </p>
        </section>

        <section className="mt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {PACKAGES.map((pkg) => (
              <button
                key={pkg.id}
                type="button"
                onClick={() => openCheckout(pkg)}
                className={[
                  "group relative rounded-3xl border px-4 py-4 text-left transition",
                  pkg.bestValue
                    ? "border-brand/50 bg-brand/10"
                    : "border-zinc-800/80 bg-black/20 hover:border-zinc-700",
                  "hover:shadow-soft-glow"
                ].join(" ")}
              >
                {pkg.bestValue ? (
                  <div className="absolute -right-2 -top-2">
                    <Badge variant="pill" className="bg-brand text-white ring-1 ring-brand/40">
                      {t("store.best")}
                    </Badge>
                  </div>
                ) : null}

                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold text-zinc-400">
                      {t("store.priceLabel")}
                    </p>
                    <p className="mt-1 text-xl font-extrabold text-white">
                      {formatUsd(pkg.priceUsd)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold text-zinc-400">
                      {t("store.coinsLabel")}
                    </p>
                    <p className="mt-1 text-lg font-extrabold text-brand">
                      {pkg.coins}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-2xl bg-black/30 p-3">
                  <p className="text-[11px] text-zinc-400">
                    {t("store.unlockHint")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-100 group-hover:text-white">
                    {t("store.choosePay")}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <h2 className="text-sm font-semibold text-zinc-100">
            {t("store.paymentMethodTitle")}
          </h2>
          <div className="mt-3 flex gap-2">
            <Link
              href="#"
              className="flex-1 rounded-2xl bg-black/30 px-4 py-3 text-sm font-semibold text-zinc-200 ring-1 ring-zinc-800/80"
            >
              Stripe
            </Link>
            <Link
              href="#"
              className="flex-1 rounded-2xl bg-black/30 px-4 py-3 text-sm font-semibold text-zinc-200 ring-1 ring-zinc-800/80"
            >
              PayPal
            </Link>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-zinc-500">
            {t("store.paymentHint")}
          </p>
        </section>
      </div>


      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <Modal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        title={t("store.checkoutTitle")}
        footer={
          <button
            type="button"
            onClick={() => setCheckoutOpen(false)}
            className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-soft-glow"
          >
            {t("store.close")}
          </button>
        }
      >
        {activePackage ? (
          <div>
            <p className="text-sm text-zinc-200">
              {formatUsd(activePackage.priceUsd)} · {activePackage.coins}{" "}
              {t("store.coinsLabel")}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setProvider("stripe")}
                className={[
                  "flex-1 rounded-2xl px-4 py-3 text-sm font-semibold ring-1",
                  provider === "stripe"
                    ? "border-brand/50 bg-brand/15 text-brand ring-brand/50"
                    : "border-zinc-800/80 bg-black/30 text-zinc-200 ring-zinc-800/80"
                ].join(" ")}
              >
                Stripe
              </button>
              <button
                type="button"
                onClick={() => setProvider("paypal")}
                className={[
                  "flex-1 rounded-2xl px-4 py-3 text-sm font-semibold ring-1",
                  provider === "paypal"
                    ? "border-brand/50 bg-brand/15 text-brand ring-brand/50"
                    : "border-zinc-800/80 bg-black/30 text-zinc-200 ring-zinc-800/80"
                ].join(" ")}
              >
                PayPal
              </button>
            </div>

            <div className="mt-3 rounded-2xl border border-zinc-800/80 bg-black/30 p-3 text-[11px] leading-5 text-zinc-400">
              {provider ? (
                <>{t("store.selectedProvider", { provider: providerLabel })}</>
              ) : (
                <>{t("store.selectProviderCta")}</>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">{t("store.noPackageSelected")}</p>
        )}
      </Modal>
    </main>
  );
}

