"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "@/components/ui/toast";
import { fetchAdminJson } from "@/lib/admin/fetch-admin-json";
import { translateAdminApiError } from "@/lib/admin/api-error";

interface RechargeRecord {
  id: string;
  uid: string;
  date: string;
  price: number;
  tier: string;
  rechargeDays: number;
  remainingDays?: number;
  createdAt?: string;
}

interface RechargeTemplateLite {
  id: string;
  label: string;
  durationDays?: number;
}

export default function AdminRechargePage() {
  const { t } = useTranslation();
  const [records, setRecords] = useState<RechargeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uidFilter, setUidFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [templateTiers, setTemplateTiers] = useState<RechargeTemplateLite[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<RechargeRecord | null>(null);

  const [form, setForm] = useState({
    uid: "",
    date: "",
    price: 29.9,
    tier: "",
    remainingDays: 30
  });

  const load = async () => {
    setLoading(true);
    const q = new URLSearchParams();
    if (uidFilter.trim()) q.set("uid", uidFilter.trim());
    if (tierFilter.trim()) q.set("tier", tierFilter.trim());
    const qs = q.size > 0 ? `?${q.toString()}` : "";
    const { json } = await fetchAdminJson<{ ok?: boolean; records?: RechargeRecord[] }>(
      `/admin/api/recharge${qs}`
    ).catch(() => ({ res: new Response(), json: null }));
    if (json?.ok && Array.isArray(json.records)) setRecords(json.records);
    else setRecords([]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    fetchAdminJson<{ ok?: boolean; config?: { subscriptionPlans?: RechargeTemplateLite[] } }>(
      "/admin/api/app-config"
    )
      .then(({ json }) => {
        if (json?.ok && Array.isArray(json.config?.subscriptionPlans)) {
          setTemplateTiers(json.config.subscriptionPlans);
          setForm((prev) => ({
            ...prev,
            tier: prev.tier || json.config?.subscriptionPlans?.[0]?.label || "/"
          }));
        }
      })
      .catch(() => {
        setTemplateTiers([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitAdd = async () => {
    if (!form.uid || !form.date || !form.tier) return;
    const { res, json } = await fetchAdminJson<{ ok?: boolean; errorKey?: string }>(
      "/admin/api/recharge",
      {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: form.uid.trim(),
        date: form.date,
        price: Number(form.price),
          tier: form.tier.trim(),
          remainingDays: Number(form.remainingDays)
        })
      }
    );
    if (!res.ok || !json?.ok) {
      showToast(translateAdminApiError(json, t), "error");
      return;
    }
    showToast(t("admin.saved"), "success");
    setAddOpen(false);
    setForm({ uid: "", date: "", price: 29.9, tier: templateTiers[0]?.label ?? "/", remainingDays: 30 });
    await load();
  };

  const openEdit = (r: RechargeRecord) => {
    setEditing(r);
    setEditOpen(true);
    setForm((prev) => ({
      ...prev,
      uid: r.uid,
      date: r.date,
      price: r.price,
      tier: r.tier,
      remainingDays: r.remainingDays ?? prev.remainingDays
    }));
  };

  const submitEditMembership = async () => {
    if (!editing) return;
    const { res, json } = await fetchAdminJson<{ ok?: boolean; errorKey?: string }>(
      "/admin/api/recharge",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: editing.uid,
          tier: form.tier.trim(),
          remainingDays: Number(form.remainingDays)
        })
      }
    );
    if (!res.ok || !json?.ok) {
      showToast(translateAdminApiError(json, t), "error");
      return;
    }
    showToast(t("admin.saved"), "success");
    setEditOpen(false);
    setEditing(null);
  };

  const submitDelete = async (r: RechargeRecord) => {
    const { res, json } = await fetchAdminJson<{ ok?: boolean; errorKey?: string }>(
      "/admin/api/recharge",
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, uid: r.uid })
      }
    );
    if (!res.ok || !json?.ok) {
      showToast(translateAdminApiError(json, t), "error");
      return;
    }
    showToast(t("admin.saved"), "success");
    await load();
  };

  const handleTierChange = (tier: string) => {
    const hit = templateTiers.find((x) => x.label === tier);
    setForm((prev) => ({
      ...prev,
      tier,
      remainingDays:
        tier === "/"
          ? prev.remainingDays
          : Number.isFinite(Number(hit?.durationDays))
            ? Math.max(0, Math.floor(Number(hit?.durationDays)))
            : prev.remainingDays
    }));
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-100">{t("admin.rechargeTitle")}</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {t("admin.rechargeHint")}
      </p>

      <div className="mt-6 flex flex-wrap items-end gap-4 rounded-xl border border-zinc-700/80 bg-zinc-900/50 p-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400">UID</label>
          <input
            type="text"
            value={uidFilter}
            onChange={(e) => setUidFilter(e.target.value)}
            placeholder="e.g. 684991731"
            className="mt-1 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-zinc-400">{t("admin.tier")}</label>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="mt-1 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white"
          >
            <option value="">{t("admin.all", "All")}</option>
            {templateTiers.map((x) => (
              <option key={x.id} value={x.label}>
                {x.label}
              </option>
            ))}
            <option value="/">/</option>
          </select>
        </div>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-700"
        >
          {t("admin.query")}
        </button>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
        >
          {t("admin.addRecord")}
        </button>
      </div>

      {addOpen ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800/80 bg-zinc-950 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-100">{t("admin.addRecord")}</h2>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-lg border border-zinc-700 bg-black/40 px-3 py-1.5 text-xs font-semibold text-zinc-200"
              >
                {t("admin.close")}
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                UID
                <input
                  value={form.uid}
                  onChange={(e) => setForm({ ...form, uid: e.target.value })}
                  className="rounded-xl border border-zinc-800/80 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand/60"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                {t("admin.date")}
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="rounded-xl border border-zinc-800/80 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand/60"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                Price (USD)
                <input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  className="rounded-xl border border-zinc-800/80 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand/60"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                {t("admin.tier")}
                <select
                  value={form.tier}
                  onChange={(e) => handleTierChange(e.target.value)}
                  className="rounded-xl border border-zinc-800/80 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand/60"
                >
                  {templateTiers.map((x) => (
                    <option key={x.id} value={x.label}>
                      {x.label}
                    </option>
                  ))}
                  <option value="/">/</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400 sm:col-span-2">
                {t("admin.remainingDays")}
                <input
                  type="number"
                  value={form.remainingDays}
                  onChange={(e) => setForm({ ...form, remainingDays: Number(e.target.value) })}
                  className="rounded-xl border border-zinc-800/80 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand/60"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-xl border border-zinc-700 bg-black/40 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-900/60"
              >
                {t("admin.cancel")}
              </button>
              <button
                type="button"
                onClick={submitAdd}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                {t("admin.submit")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editOpen && editing ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-zinc-800/80 bg-zinc-950 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-100">{t("admin.editMembership")}</h2>
              <button
                type="button"
                onClick={() => {
                  setEditOpen(false);
                  setEditing(null);
                }}
                className="rounded-lg border border-zinc-700 bg-black/40 px-3 py-1.5 text-xs font-semibold text-zinc-200"
              >
                {t("admin.close")}
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                UID
                <input
                  value={editing.uid}
                  disabled
                  className="rounded-xl border border-zinc-800/80 bg-black/20 px-3 py-2 text-sm text-zinc-500"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400">
                {t("admin.tier")}
                <select
                  value={form.tier}
                  onChange={(e) => handleTierChange(e.target.value)}
                  className="rounded-xl border border-zinc-800/80 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand/60"
                >
                  {templateTiers.map((x) => (
                    <option key={x.id} value={x.label}>
                      {x.label}
                    </option>
                  ))}
                  <option value="/">/</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs text-zinc-400 sm:col-span-2">
                {t("admin.remainingDays")}
                <input
                  type="number"
                  value={form.remainingDays}
                  onChange={(e) => setForm({ ...form, remainingDays: Number(e.target.value) })}
                  className="rounded-xl border border-zinc-800/80 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand/60"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditOpen(false);
                  setEditing(null);
                }}
                className="rounded-xl border border-zinc-700 bg-black/40 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-900/60"
              >
                {t("admin.cancel")}
              </button>
              <button
                type="button"
                onClick={submitEditMembership}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                {t("admin.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-700/80 bg-zinc-900/50">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">{t("admin.loading")}</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">{t("admin.noRecordsYet")}</div>
        ) : (
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-zinc-700/80">
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">UID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.date")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.amount")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.tier")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.remainingDays")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.time")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("admin.action")}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-zinc-800/60 last:border-0">
                  <td className="px-4 py-3 text-sm font-mono text-brand">{r.uid}</td>
                  <td className="px-4 py-3 text-sm text-white">{r.date}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-white">
                    ${r.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-300">{r.tier}</td>
                  <td className="px-4 py-3 text-sm text-zinc-300">{r.remainingDays ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {r.createdAt ? new Date(r.createdAt).toLocaleTimeString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="rounded-lg border border-zinc-700 bg-black/40 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-900/60"
                      >
                        {t("admin.edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => submitDelete(r)}
                        className="rounded-lg border border-red-700/70 bg-red-950/30 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-900/40"
                      >
                        {t("admin.delete", "Delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
