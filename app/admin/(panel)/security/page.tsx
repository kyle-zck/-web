"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { showToast } from "@/components/ui/toast";

export default function AdminSecurityPage() {
  const { t } = useTranslation();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch("/admin/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        signal: ctrl.signal,
        body: JSON.stringify({
          oldPassword: oldPw,
          newPassword: newPw,
          confirmPassword: confirmPw
        })
      });
      const json = (await res.json()) as { ok?: boolean; errorKey?: string };
      if (!res.ok || !json.ok) {
        const k = json.errorKey;
        setError(k ? String(t(`admin.${k}`)) : String(t("common.admin.submitFailed")));
        return;
      }
      showToast(t("common.admin.passwordChangeSuccess"), "success");
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
    } catch {
      setError(t("common.admin.networkError"));
    } finally {
      window.clearTimeout(timer);
      setLoading(false);
    }
  };

  return (
    <main>
      <div>
        <h1 className="text-xl font-extrabold text-zinc-100">{t("common.admin.securityPassword")}</h1>
        <p className="mt-1 text-xs text-zinc-400">{t("common.admin.accountMgmtHint")}</p>
      </div>

      <section className="mt-6 max-w-lg rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-5">
        <h2 className="text-sm font-semibold text-brand">{t("common.admin.accountManagement")}</h2>
        <form onSubmit={onChangePassword} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-zinc-400">{t("common.admin.currentPassword")}</span>
            <input
              type="password"
              autoComplete="current-password"
              value={oldPw}
              onChange={(e) => setOldPw(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-800/80 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand/60"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-zinc-400">{t("common.admin.newPassword")}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-800/80 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand/60"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-zinc-400">{t("common.admin.confirmPassword")}</span>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-800/80 bg-black/30 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-brand/60"
            />
          </label>
          {error ? <p className="text-xs text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-soft-glow disabled:opacity-60"
          >
            {loading ? t("common.admin.saving") : t("common.admin.saveNewPassword")}
          </button>
        </form>
      </section>
    </main>
  );
}
