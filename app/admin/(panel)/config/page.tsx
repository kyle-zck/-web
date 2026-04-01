"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SubscriptionPlan } from "@/constants/mock-data";
import { showToast } from "@/components/ui/toast";
import { fetchAdminJson } from "@/lib/admin/fetch-admin-json";
import { translateAdminApiError } from "@/lib/admin/api-error";
import type { AppConfigStore } from "@/lib/app-config";
import {
  assignClientRowKeys,
  CLIENT_ROW_KEY,
  newClientRowKey,
  stripClientRowKey,
  type WithClientRowKey
} from "@/lib/admin/client-row-key";

function normalizePlanId(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "");
}

export default function AdminConfigPage() {
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 正在编辑（未暂存）
  const [plansEdit, setPlansEdit] = useState<WithClientRowKey<SubscriptionPlan>[]>([]);
  const [storeTitleEdit, setStoreTitleEdit] = useState("");
  const [storeSubtitleEdit, setStoreSubtitleEdit] = useState("");
  const [tipsEdit, setTipsEdit] = useState<string[]>(["", "", "", ""]);

  // 已暂存（尚未应用到全站）
  const [draftPlans, setDraftPlans] = useState<SubscriptionPlan[]>([]);
  const [draftStore, setDraftStore] = useState<AppConfigStore>({});

  const loadConfig = async (signal?: AbortSignal) => {
    setLoadError(null);
    setLoaded(false);
    try {
      const { res, json } = await fetchAdminJson<{ ok?: boolean; config?: any; errorKey?: string }>(
        "/admin/api/app-config",
        { signal },
        10000
      );
      if (!res.ok || !json?.ok) {
        setPlansEdit([]);
        setDraftPlans([]);
        setLoadError(translateAdminApiError(json, t, "admin.loading"));
        return;
      }
      const cfg = json?.config ?? {};
      const plans = (cfg?.subscriptionPlans ?? []) as SubscriptionPlan[];
      const store = (cfg?.store ?? {}) as AppConfigStore;

      setPlansEdit(assignClientRowKeys(plans));
      setDraftPlans(plans);

      setStoreTitleEdit(store?.title ?? "");
      setStoreSubtitleEdit(store?.subtitle ?? "");
      setTipsEdit(Array.isArray(store?.tips) ? [...store.tips] : ["", "", "", ""]);

      setDraftStore({
        title: store?.title ?? "",
        subtitle: store?.subtitle ?? "",
        tips: Array.isArray(store?.tips) ? [...store.tips] : undefined
      });
    } catch {
      setPlansEdit([]);
      setDraftPlans([]);
      setLoadError(String(t("common.admin.networkError")));
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    loadConfig(ctrl.signal);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePlan = (index: number, patch: Partial<SubscriptionPlan>) => {
    const next = [...plansEdit];
    next[index] = { ...next[index], ...patch };
    setPlansEdit(next);
  };

  const addPlan = () => {
    const nextId = `plan-${Date.now()}`;
    setPlansEdit([
      ...plansEdit,
      {
        id: nextId,
        templateName: nextId,
        label: t("common.admin.newPlan"),
        priceUsd: 9.99,
        durationDays: 30,
        discountPercent: 100,
        discountDays: 0,
        paymentUrl: "/store",
        stripePriceId: "",
        [CLIENT_ROW_KEY]: newClientRowKey()
      }
    ]);
  };

  const removePlan = (index: number) => {
    setPlansEdit(plansEdit.filter((_, i) => i !== index));
  };

  const stagePlans = () => {
    const now = new Date().toISOString();
    const staged = plansEdit.map((p) => {
      const row = stripClientRowKey(p);
      const normalizedId = normalizePlanId(String(row.id ?? row.templateName ?? ""));
      const dp =
        typeof row.discountPercent === "number" ? row.discountPercent : Number(row.discountPercent ?? 100);
      const dd = typeof row.discountDays === "number" ? row.discountDays : Number(row.discountDays ?? 0);
      const discountPercent = Number.isFinite(dp) ? Math.max(1, Math.min(100, Math.round(dp))) : 100;
      const discountDays = Number.isFinite(dd) ? Math.max(0, Math.floor(dd)) : 0;
      const next: SubscriptionPlan = {
        ...row,
        id: normalizedId || `plan-${Date.now()}`,
        templateName: normalizedId || `plan-${Date.now()}`,
        stripePriceId: String((row as { stripePriceId?: string }).stripePriceId ?? "").trim(),
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
    showToast(t("common.admin.saved"), "success");
  };

  const stageTitleIntro = () => {
    setDraftStore((prev) => ({
      ...prev,
      title: storeTitleEdit,
      subtitle: storeSubtitleEdit
    }));
    showToast(t("common.admin.saved"), "success");
  };

  const stageTips = () => {
    const nextTips = tipsEdit.map((x) => x ?? "").filter((x) => String(x).trim().length > 0);
    setDraftStore((prev) => ({
      ...prev,
      tips: nextTips.length ? nextTips : []
    }));
    showToast(t("common.admin.saved"), "success");
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
      showToast(t("common.admin.saved"), "success");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <main>
        <p className="text-sm text-zinc-400">{t("common.admin.loading")}</p>
      </main>
    );
  }

  return (
    <main>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-zinc-100">{t("common.admin.rechargeTemplateManagement")}</h1>
          <p className="mt-1 text-xs text-zinc-400">
            {t("common.admin.configHint")}
          </p>
        </div>
        <button
          type="button"
          onClick={applyAll}
          disabled={saving}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? t("common.admin.saving") : t("common.admin.save")}
        </button>
      </div>

      {loadError ? (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => loadConfig()}
            className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/20"
          >
            {t("common.admin.query")}
          </button>
        </div>
      ) : null}

      <section className="mt-5 rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">{t("common.admin.subscriptionPlans")}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addPlan}
              className="rounded-full bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700"
            >
              {t("common.admin.addPlan")}
            </button>
            <button
              type="button"
              onClick={stagePlans}
              className="rounded-full bg-brand/15 px-3 py-1.5 text-xs font-semibold text-brand ring-1 ring-brand/40 hover:bg-brand/20"
            >
              {t("common.admin.save")}
            </button>
          </div>
        </div>
        <div className="mt-3 space-y-3">
          {plansEdit.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800/80 bg-black/30 p-6 text-center text-sm text-zinc-500">
              {t("common.admin.noRechargeTemplatesYet")}
            </div>
          ) : (
            plansEdit.map((plan, i) => (
              <div
                key={plan[CLIENT_ROW_KEY] ?? `plan-fallback-${i}`}
                className="rounded-2xl border border-zinc-800/80 bg-black/35 p-3"
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  Plan ID (key)
                  <input
                    value={plan.id ?? plan.templateName ?? ""}
                    onChange={(e) => {
                      const nextId = normalizePlanId(e.target.value);
                      updatePlan(i, { id: nextId, templateName: nextId });
                    }}
                    placeholder="month / week / year"
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
                  {t("common.admin.priceUsd")}
                  <input
                    type="number"
                    step="0.01"
                    value={plan.priceUsd}
                    onChange={(e) => updatePlan(i, { priceUsd: Number(e.target.value) })}
                    className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-zinc-400">
                  {t("common.admin.durationDays")}
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
                    {t("common.admin.paymentUrl")}
                    <input
                      value={plan.paymentUrl ?? ""}
                      onChange={(e) => updatePlan(i, { paymentUrl: e.target.value || undefined })}
                      placeholder="/store"
                      className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
                    />
                  </label>
                  <label className="flex flex-1 flex-col gap-1 text-xs text-zinc-400">
                    Stripe Price ID
                    <input
                      value={String((plan as any).stripePriceId ?? "")}
                      onChange={(e) =>
                        updatePlan(i, { stripePriceId: e.target.value.trim() || undefined } as Partial<SubscriptionPlan>)
                      }
                      placeholder="price_..."
                      className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removePlan(i)}
                    className="rounded-lg border border-red-500/50 bg-red-500/10 px-2 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                  >
                    {t("common.admin.delete")}
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
          <h2 className="text-sm font-semibold text-zinc-100">{t("common.admin.storeTitleConfig")}</h2>
          <button
            type="button"
            onClick={stageTitleIntro}
            className="rounded-full bg-brand/15 px-3 py-1.5 text-xs font-semibold text-brand ring-1 ring-brand/40 hover:bg-brand/20"
          >
            {t("common.admin.save")}
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {t("common.admin.title")}
            <input
              value={storeTitleEdit}
              onChange={(e) => setStoreTitleEdit(e.target.value)}
              className="rounded-lg border border-zinc-800 bg-black/50 px-3 py-2 text-zinc-100"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-400">
            {t("common.admin.subtitle")}
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
          <h2 className="text-sm font-semibold text-zinc-100">{t("common.admin.storeTipsConfig")}</h2>
          <button
            type="button"
            onClick={stageTips}
            className="rounded-full bg-brand/15 px-3 py-1.5 text-xs font-semibold text-brand ring-1 ring-brand/40 hover:bg-brand/20"
          >
            {t("common.admin.save")}
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {tipsEdit.map((line, idx) => (
            <label key={idx} className="flex flex-col gap-1 text-xs text-zinc-400">
              {String(t("common.admin.tipLine", { n: idx + 1 } as any))}
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

    </main>
  );
}
