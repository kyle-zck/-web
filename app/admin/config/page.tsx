"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SubscriptionPlan } from "@/constants/mock-data";

export default function AdminConfigPage() {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/admin/api/app-config")
      .then((r) => r.json())
      .then((json) => {
        const cfg = json?.config ?? json;
        setPlans(cfg?.subscriptionPlans ?? []);
      })
      .catch(() => setPlans([]));
  }, []);

  const updatePlan = (index: number, patch: Partial<SubscriptionPlan>) => {
    const next = [...plans];
    next[index] = { ...next[index], ...patch };
    setPlans(next);
  };

  const addPlan = () => {
    setPlans([
      ...plans,
      {
        id: `plan-${Date.now()}`,
        label: t("admin.newPlan"),
        priceUsd: 9.99,
        durationDays: 30,
        paymentUrl: "/store"
      }
    ]);
  };

  const removePlan = (index: number) => {
    setPlans(plans.filter((_, i) => i !== index));
  };

  const save = async () => {
    try {
      setSaving(true);
      await fetch("/admin/api/app-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionPlans: plans })
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-zinc-100">{t("admin.subscriptionConfig")}</h1>
          <p className="mt-1 text-xs text-zinc-400">
            {t("admin.configHint")}
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? t("admin.saving") : t("admin.save")}
        </button>
      </div>

      <section className="mt-5 rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">{t("admin.subscriptionPlans")}</h2>
          <button
            type="button"
            onClick={addPlan}
            className="rounded-full bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
          >
            {t("admin.addPlan")}
          </button>
        </div>
        <div className="mt-3 space-y-4">
          {plans.map((plan, i) => (
            <div
              key={plan.id}
              className="rounded-xl border border-zinc-800/80 bg-black/30 p-4"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  ID
                  <input
                    value={plan.id}
                    onChange={(e) => updatePlan(i, { id: e.target.value })}
                    className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  Label
                  <input
                    value={plan.label}
                    onChange={(e) => updatePlan(i, { label: e.target.value })}
                    className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  {t("admin.priceUsd")}
                  <input
                    type="number"
                    step="0.01"
                    value={plan.priceUsd}
                    onChange={(e) => updatePlan(i, { priceUsd: Number(e.target.value) })}
                    className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  {t("admin.durationDays")}
                  <input
                    type="number"
                    value={plan.durationDays}
                    onChange={(e) => updatePlan(i, { durationDays: Number(e.target.value) })}
                    className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
                  />
                </label>
                <div className="flex items-end gap-2">
                  <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-400">
                    {t("admin.paymentUrl")}
                    <input
                      value={plan.paymentUrl ?? ""}
                      onChange={(e) => updatePlan(i, { paymentUrl: e.target.value || undefined })}
                      placeholder="/store"
                      className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removePlan(i)}
                    className="rounded-lg border border-red-500/50 bg-red-500/10 px-2 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                  >
                    {t("admin.delete")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
