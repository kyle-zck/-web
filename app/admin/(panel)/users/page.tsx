"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchAdminJson } from "@/lib/admin/fetch-admin-json";

interface AdminUserSafe {
  uid: string;
  createdAt: string;
  name: string;
  email: string;
  phone: string;
  provider: "" | "google" | "facebook" | "apple";
  lastLoginAt: string;
  lastLoginIp: string;
  status: "active" | "disabled";
  membershipPlan: string;
  membershipExpiresAt: string;
  deviceType: "ios" | "android" | "web" | "unknown";
  rechargeCount?: number;
  rechargeTotalUsd?: number;
  lastRechargeAt?: string;
  rechargeRecent?: string[];
}

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AdminUserSafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uid, setUid] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState<"" | "google" | "facebook" | "apple">("");
  const [membershipPlan, setMembershipPlan] = useState("");
  const [remainingSort, setRemainingSort] = useState<"" | "remainingAsc" | "remainingDesc">("");
  const [planOptions, setPlanOptions] = useState<string[]>([]);
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (uid.trim()) p.set("uid", uid.trim());
    if (name.trim()) p.set("name", name.trim());
    if (email.trim()) p.set("email", email.trim());
    if (provider) p.set("provider", provider);
    if (membershipPlan.trim()) p.set("membershipPlan", membershipPlan.trim());
    if (remainingSort) p.set("remainingSort", remainingSort);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [uid, name, email, provider, membershipPlan, remainingSort]);

  useEffect(() => {
    fetchAdminJson<{ ok?: boolean; config?: { subscriptionPlans?: Array<{ label?: string }> } }>(
      "/admin/api/app-config",
      undefined,
      10000
    )
      .then(({ res, json }) => {
        if (!res.ok || !json?.ok) {
          setPlanOptions([]);
          return;
        }
        const plans = Array.isArray(json.config?.subscriptionPlans) ? json.config?.subscriptionPlans : [];
        const labels = plans.map((x) => (typeof x?.label === "string" ? x.label : "")).filter(Boolean) as string[];
        setPlanOptions(labels);
      })
      .catch(() => setPlanOptions([]));
  }, []);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 10000);
    fetch(`/admin/api/users${qs}`, { signal: ctrl.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.users)) {
          setUsers(json.users);
        } else {
          setUsers([]);
          setLoadError(String(t("common.admin.submitFailed")));
        }
      })
      .catch(() => {
        setUsers([]);
        setLoadError(String(t("common.admin.networkError")));
      })
      .finally(() => {
        window.clearTimeout(timer);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  const providerLabel = (p: AdminUserSafe["provider"]) => {
    if (p === "google") return "Google";
    if (p === "facebook") return "Facebook";
    if (p === "apple") return "Apple ID";
    return t("common.admin.unnamed");
  };

  const remainingText = (expiresAtIso: string) => {
    if (!expiresAtIso) return "-";
    const ms = new Date(expiresAtIso).getTime() - Date.now();
    if (!Number.isFinite(ms)) return "-";
    const sign = ms < 0 ? "-" : "";
    const abs = Math.abs(ms);
    const days = Math.floor(abs / (24 * 3600 * 1000));
    const hours = Math.floor((abs % (24 * 3600 * 1000)) / (3600 * 1000));
    return `${sign}${days}d ${hours}h`;
  };

  const toggleUserRow = (uidValue: string, checked: boolean) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (checked) next.add(uidValue);
      else next.delete(uidValue);
      return next;
    });
  };

  const toggleAllUsers = (checked: boolean) => {
    setSelectedUids((prev) => {
      const next = new Set(prev);
      if (checked) users.forEach((u) => next.add(u.uid));
      else users.forEach((u) => next.delete(u.uid));
      return next;
    });
  };

  const batchDeleteUsers = async () => {
    const uids = users.map((u) => u.uid).filter((uidValue) => selectedUids.has(uidValue));
    if (uids.length === 0) return;
    if (!confirm(t("common.admin.confirmDeleteSelectedUsers", { count: uids.length }))) return;
    const { res, json } = await fetchAdminJson<{ ok?: boolean; removed?: number; error?: string }>(
      "/admin/api/users",
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uids })
      },
      10000
    );
    if (!res.ok || !json?.ok) return;
    setSelectedUids((prev) => {
      const next = new Set(prev);
      uids.forEach((u) => next.delete(u));
      return next;
    });
    load();
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-100">{t("common.admin.usersTitle")}</h1>
      <p className="mt-1 text-sm text-zinc-400">
        {t("common.admin.usersHint")}
      </p>

      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-700/80 bg-zinc-900/50 p-4">
        <label className="block">
          <span className="block text-xs font-semibold text-zinc-400">UID</span>
          <input
            value={uid}
            onChange={(e) => setUid(e.target.value)}
            className="mt-1 w-44 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500"
            placeholder="UID"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-zinc-400">{t("common.admin.name")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-56 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500"
            placeholder="Name"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-zinc-400">Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-64 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500"
            placeholder="Email"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-zinc-400">{t("common.admin.loginProvider")}</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as any)}
            className="mt-1 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white"
          >
            <option value="">{t("common.admin.allOption")}</option>
            <option value="google">Google</option>
            <option value="facebook">Facebook</option>
            <option value="apple">Apple ID</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-zinc-400">{t("common.admin.membershipPlan")}</span>
          <select
            value={membershipPlan}
            onChange={(e) => setMembershipPlan(e.target.value)}
            className="mt-1 w-56 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white"
          >
            <option value="">{t("common.admin.allOption")}</option>
            {planOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="block text-xs font-semibold text-zinc-400">{t("common.admin.remainingSort")}</span>
          <select
            value={remainingSort}
            onChange={(e) => setRemainingSort(e.target.value as any)}
            className="mt-1 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-white"
          >
            <option value="">{t("common.admin.none")}</option>
            <option value="remainingAsc">{t("common.admin.remainingAsc")}</option>
            <option value="remainingDesc">{t("common.admin.remainingDesc")}</option>
          </select>
        </label>
        <button
          type="button"
          onClick={load}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
        >
          {t("common.admin.query")}
        </button>
        <button
          type="button"
          onClick={() => {
            setUid("");
            setName("");
            setEmail("");
            setProvider("");
            setMembershipPlan("");
            setRemainingSort("");
          }}
          className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-700"
        >
          {t("common.admin.reset")}
        </button>
        <button
          type="button"
          onClick={batchDeleteUsers}
          disabled={users.filter((u) => selectedUids.has(u.uid)).length === 0}
          className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-50"
        >
          {t("common.admin.batchDeleteWithCount", { count: users.filter((u) => selectedUids.has(u.uid)).length })}
        </button>
      </div>

      {loadError ? (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-500/20"
          >
            {t("common.admin.query")}
          </button>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-700/80 bg-zinc-900/50">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">{t("common.admin.loading")}</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">{t("common.admin.noUsersYet")}</div>
        ) : (
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-zinc-700/80">
                <th className="px-3 py-3 text-left text-xs font-semibold text-zinc-400">
                  <input
                    type="checkbox"
                    checked={users.length > 0 && users.every((u) => selectedUids.has(u.uid))}
                    onChange={(e) => toggleAllUsers(e.target.checked)}
                    aria-label="Select all"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">UID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.name")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.phone")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.loginProvider")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.created")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.lastLoginAt")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.lastLoginIp")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.accountStatus")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.membershipPlan")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.remainingTime")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">{t("common.admin.deviceType")}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">Recharge</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-400">Recharge History</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} className="border-b border-zinc-800/60 last:border-0">
                  <td className="px-3 py-3 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={selectedUids.has(u.uid)}
                      onChange={(e) => toggleUserRow(u.uid, e.target.checked)}
                      aria-label={`Select user ${u.uid}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-mono font-semibold text-brand">{u.uid}</td>
                  <td className="px-4 py-3 text-sm text-white">{u.name || "-"}</td>
                  <td className="px-4 py-3 text-sm text-zinc-300">{u.email || "-"}</td>
                  <td className="px-4 py-3 text-sm text-zinc-300">{u.phone || "-"}</td>
                  <td className="px-4 py-3 text-sm text-zinc-300">{providerLabel(u.provider)}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {new Date(u.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{u.lastLoginIp || "-"}</td>
                  <td className="px-4 py-3 text-xs text-zinc-300">
                    {u.status === "disabled" ? t("common.admin.statusDisabled") : t("common.admin.statusActive")}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-300">{u.membershipPlan || "-"}</td>
                  <td className="px-4 py-3 text-xs text-zinc-300">{remainingText(u.membershipExpiresAt)}</td>
                  <td className="px-4 py-3 text-xs text-zinc-300">{u.deviceType}</td>
                  <td className="px-4 py-3 text-xs text-zinc-300">
                    {u.rechargeCount ?? 0} / ${Number(u.rechargeTotalUsd ?? 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {Array.isArray(u.rechargeRecent) && u.rechargeRecent.length > 0
                      ? u.rechargeRecent.join(" | ")
                      : "-"}
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
