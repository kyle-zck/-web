"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SubscriptionPlan } from "@/constants/mock-data";
import { showToast } from "@/components/ui/toast";
import { fetchAdminJson } from "@/lib/admin/fetch-admin-json";
import { translateAdminApiError } from "@/lib/admin/api-error";
import type { AppConfigStore } from "@/lib/app-config";

export default function AdminConfigPage() {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // 正在编辑（未暂存）
  const [plansEdit, setPlansEdit] = useState<SubscriptionPlan[]>([]);
  const [storeTitleEdit, setStoreTitleEdit] = useState("");
  const [storeSubtitleEdit, setStoreSubtitleEdit] = useState("");
  const [tipsEdit, setTipsEdit] = useState<string[]>(["", "", "", ""]);
  const [paymentMethodsEdit, setPaymentMethodsEdit] = useState<
    Array<{ id: string; label: string; icon: string }>
  >([]);

  // 已暂存（尚未应用到全站）
  const [draftPlans, setDraftPlans] = useState<SubscriptionPlan[]>([]);
  const [draftStore, setDraftStore] = useState<AppConfigStore>({});

  useEffect(() => {
    fetchAdminJson<{ ok?: boolean; config?: any }>("/admin/api/app-config")
      .then(({ json }) => {
        const cfg = json?.config ?? {};
        const plans = (cfg?.subscriptionPlans ?? []) as SubscriptionPlan[];
        const store = (cfg?.store ?? {}) as AppConfigStore;

        setPlansEdit(plans);
        setDraftPlans(plans);

        setStoreTitleEdit(store?.title ?? "");
        setStoreSubtitleEdit(store?.subtitle ?? "");
        setTipsEdit(Array.isArray(store?.tips) ? [...store.tips] : ["", "", "", ""]);
        setPaymentMethodsEdit(
          Array.isArray(store?.paymentMethods) ? [...store.paymentMethods] : []
        );

        setDraftStore({
          title: store?.title ?? "",
          subtitle: store?.subtitle ?? "",
          tips: Array.isArray(store?.tips) ? [...store.tips] : undefined,
          paymentMethods: Array.isArray(store?.paymentMethods)
            ? [...store.paymentMethods]
            : undefined
        });
      })
      .catch(() => {
        setPlansEdit([]);
        setDraftPlans([]);
      })
      .finally(() => setLoaded(true));
  }, []);

  const updatePlan = (index: number, patch: Partial<SubscriptionPlan>) => {
    const next = [...plansEdit];
    next[index] = { ...next[index], ...patch };
    setPlansEdit(next);
  };

  const addPlan = () => {
    setPlansEdit([
      ...plansEdit,
      {
        id: `plan-${Date.now()}`,
        templateName: t("admin.newPlan"),
        label: t("admin.newPlan"),
        priceUsd: 9.99,
        durationDays: 30,
        discountPercent: 100,
        discountDays: 0,
        paymentUrl: "/store"
      }
    ]);
  };

  const removePlan = (index: number) => {
    setPlansEdit(plansEdit.filter((_, i) => i !== index));
  };

  const stagePlans = () => {
    const now = new Date().toISOString();
    const staged = plansEdit.map((p) => {
      const dp = typeof p.discountPercent === "number" ? p.discountPercent : Number(p.discountPercent ?? 100);
      const dd = typeof p.discountDays === "number" ? p.discountDays : Number(p.discountDays ?? 0);
      const discountPercent = Number.isFinite(dp) ? Math.max(1, Math.min(100, Math.round(dp))) : 100;
      const discountDays = Number.isFinite(dd) ? Math.max(0, Math.floor(dd)) : 0;
      const next: SubscriptionPlan = {
        ...p,
        discountPercent,
        discountDays
      };
      if (discountPercent >= 100 || discountDays <= 0) {
        delete (next as any).discountStartAt;
      } else if (!next.discountStartAt) {
        next.discountStartAt = now;
      }
      return next;
    });
    setDraftPlans(staged);
    showToast(t("admin.saved"), "success");
  };

  const stageTitleIntro = () => {
    setDraftStore((prev) => ({
      ...prev,
      title: storeTitleEdit,
      subtitle: storeSubtitleEdit
    }));
    showToast(t("admin.saved"), "success");
  };

  const stageTips = () => {
    const nextTips = tipsEdit.map((x) => x ?? "").filter((x) => String(x).trim().length > 0);
    setDraftStore((prev) => ({
      ...prev,
      tips: nextTips.length ? nextTips : []
    }));
    showToast(t("admin.saved"), "success");
  };

  const stagePaymentModes = () => {
    const cleaned = paymentMethodsEdit
      .map((x) => ({
        id: String(x.id ?? "").trim(),
        label: String(x.label ?? "").trim(),
        icon: String(x.icon ?? "").trim()
      }))
      .filter((x) => x.id && x.label);
    setDraftStore((prev) => ({
      ...prev,
      paymentMethods: cleaned
    }));
    showToast(t("admin.saved"), "success");
  };

  const applyAll = async () => {
    try {
      setSaving(true);
      const { res, json } = await fetchAdminJson<{ ok?: boolean; errorKey?: string; config?: any }>(
        "/admin/api/app-config",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscriptionPlans: draftPlans,
            store: draftStore
          })
        }
      );
      if (!res.ok || !json?.ok) {
        showToast(translateAdminApiError(json, t), "error");
        return;
      }
      showToast(t("admin.saved"), "success");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <main>
        <p className="text-sm text-zinc-400">{t("admin.loading")}</p>
      </main>
    );
  }

  return (
    <main>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-zinc-100">{t("admin.rechargeTemplateManagement")}</h1>
          <p className="mt-1 text-xs text-zinc-400">
            {t("admin.configHint")}
          </p>
        </div>
        <button
          type="button"
          onClick={applyAll}
          disabled={saving}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? t("admin.saving") : t("admin.save")}
        </button>
      </div>

      <section className="mt-5 rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">{t("admin.subscriptionPlans")}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addPlan}
              className="rounded-full bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
            >
              {t("admin.addPlan")}
            </button>
            <button
              type="button"
              onClick={stagePlans}
              className="rounded-full bg-brand/15 px-3 py-1.5 text-xs font-semibold text-brand ring-1 ring-brand/40 hover:bg-brand/20"
            >
              {t("admin.save")}
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          {plansEdit.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800/80 bg-black/30 p-6 text-center text-sm text-zinc-500">
              {t("admin.noRechargeTemplatesYet")}
            </div>
          ) : (
            plansEdit.map((plan, i) => (
              <div
                key={plan.id}
                className="rounded-2xl border border-zinc-800/80 bg-black/35 p-3"
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  Template name
                  <input
                    value={plan.templateName ?? ""}
                    onChange={(e) => updatePlan(i, { templateName: e.target.value })}
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
                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  Discount (%)
                  <input
                    type="number"
                    value={plan.discountPercent ?? 100}
                    onChange={(e) => updatePlan(i, { discountPercent: Number(e.target.value) })}
                    className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  Discount days
                  <input
                    type="number"
                    value={plan.discountDays ?? 0}
                    onChange={(e) => updatePlan(i, { discountDays: Number(e.target.value) })}
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
            ))
          )}
        </div>
      </section>

      {/* 图3：标题与子介绍编辑 */}
      <section className="mt-5 rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">{t("admin.storeTitleConfig")}</h2>
          <button
            type="button"
            onClick={stageTitleIntro}
            className="rounded-full bg-brand/15 px-3 py-1.5 text-xs font-semibold text-brand ring-1 ring-brand/40 hover:bg-brand/20"
          >
            {t("admin.save")}
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {t("admin.title")}
            <input
              value={storeTitleEdit}
              onChange={(e) => setStoreTitleEdit(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {t("admin.subtitle")}
            <input
              value={storeSubtitleEdit}
              onChange={(e) => setStoreSubtitleEdit(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
            />
          </label>
        </div>
      </section>

      {/* 图4：Tips 内容编辑 */}
      <section className="mt-5 rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">{t("admin.storeTipsConfig")}</h2>
          <button
            type="button"
            onClick={stageTips}
            className="rounded-full bg-brand/15 px-3 py-1.5 text-xs font-semibold text-brand ring-1 ring-brand/40 hover:bg-brand/20"
          >
            {t("admin.save")}
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {tipsEdit.map((line, idx) => (
            <label key={idx} className="flex flex-col gap-1 text-xs text-zinc-400">
              {String(t("admin.tipLine", { n: idx + 1 } as any))}
              <input
                value={line}
                onChange={(e) => {
                  const next = [...tipsEdit];
                  next[idx] = e.target.value;
                  setTipsEdit(next);
                }}
                className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
              />
            </label>
          ))}
        </div>
      </section>

      {/* 图5：支付模式编辑 */}
      <section className="mt-5 rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">{t("admin.storePaymentModesConfig")}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setPaymentMethodsEdit((prev) => [
                  ...prev,
                  { id: `pm-${Date.now()}`, label: "New", icon: "💳" }
                ])
              }
              className="rounded-full bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
            >
              {t("admin.addButton")}
            </button>
            <button
              type="button"
              onClick={stagePaymentModes}
              className="rounded-full bg-brand/15 px-3 py-1.5 text-xs font-semibold text-brand ring-1 ring-brand/40 hover:bg-brand/20"
            >
              {t("admin.save")}
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          {paymentMethodsEdit.length === 0 ? (
            <p className="text-xs text-zinc-500">{t("admin.noDataShort")}</p>
          ) : (
            paymentMethodsEdit.map((pm, idx) => (
              <div key={pm.id} className="grid gap-3 sm:grid-cols-4">
                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  ID
                  <input
                    value={pm.id}
                    onChange={(e) => {
                      const next = [...paymentMethodsEdit];
                      next[idx] = { ...next[idx], id: e.target.value };
                      setPaymentMethodsEdit(next);
                    }}
                    className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  Label
                  <input
                    value={pm.label}
                    onChange={(e) => {
                      const next = [...paymentMethodsEdit];
                      next[idx] = { ...next[idx], label: e.target.value };
                      setPaymentMethodsEdit(next);
                    }}
                    className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  Icon
                  <input
                    value={pm.icon}
                    onChange={(e) => {
                      const next = [...paymentMethodsEdit];
                      next[idx] = { ...next[idx], icon: e.target.value };
                      setPaymentMethodsEdit(next);
                    }}
                    className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setPaymentMethodsEdit((prev) => prev.filter((_, i) => i !== idx))}
                    className="w-full rounded-lg border border-red-500/50 bg-red-500/10 px-2 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                  >
                    {t("admin.delete")}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
