"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { showToast } from "@/components/ui/toast";
import { ADMIN_TAB_SESSION_KEY } from "@/lib/admin/tab-session";

export default function AdminLoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mgmtOpen, setMgmtOpen] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [mgmtLoading, setMgmtLoading] = useState(false);
  const [mgmtError, setMgmtError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/admin/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
        credentials: "include"
      });
      if (!res.ok) {
        setError(t("admin.invalidKey"));
        return;
      }
      try {
        sessionStorage.setItem(ADMIN_TAB_SESSION_KEY, "1");
      } catch {
        /* private mode 等 */
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError(t("admin.networkError"));
    } finally {
      setLoading(false);
    }
  };

  const onChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMgmtLoading(true);
    setMgmtError(null);
    try {
      const res = await fetch("/admin/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword: oldPw,
          newPassword: newPw,
          confirmPassword: confirmPw
        })
      });
      const json = (await res.json()) as { ok?: boolean; errorKey?: string };
      if (!res.ok || !json.ok) {
        const k = json.errorKey;
        setMgmtError(
          k ? String(t(`admin.${k}`)) : String(t("admin.submitFailed"))
        );
        return;
      }
      showToast(t("admin.passwordChangeSuccess"), "success");
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
      setMgmtOpen(false);
    } catch {
      setMgmtError(t("admin.networkError"));
    } finally {
      setMgmtLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black px-4">
      <div className="mx-auto max-w-md pt-10">
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-6">
          <p className="text-sm font-semibold text-zinc-100">{t("admin.adminLogin")}</p>
          <p className="mt-1 text-xs text-zinc-400">{t("admin.loginHint")}</p>

          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-zinc-400">{t("admin.adminKey")}</span>
              <input
                type="password"
                autoComplete="current-password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={t("admin.enterKey")}
                className="mt-1 w-full rounded-2xl border border-zinc-800/80 bg-black/30 px-4 py-3 text-sm font-semibold text-zinc-100 outline-none ring-0 focus:border-brand/60"
              />
            </label>

            {error ? (
              <p className="text-xs text-red-400">{error}</p>
            ) : (
              <p className="text-[11px] leading-5 text-zinc-500">{t("admin.keyHint")}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-soft-glow disabled:opacity-70"
            >
              {loading ? t("admin.checking") : t("admin.login")}
            </button>
          </form>

          <div className="mt-6 border-t border-zinc-800/60 pt-5">
            <button
              type="button"
              onClick={() => {
                setMgmtOpen(!mgmtOpen);
                setMgmtError(null);
              }}
              className="text-xs font-semibold text-brand hover:underline"
            >
              {mgmtOpen ? "▼ " : "▶ "}
              {t("admin.accountManagement")}
            </button>

            {mgmtOpen && (
              <form onSubmit={onChangePassword} className="mt-4 space-y-3">
                <p className="text-[11px] text-zinc-500">{t("admin.accountMgmtHint")}</p>
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-400">
                    {t("admin.currentPassword")}
                  </span>
                  <input
                    type="password"
                    value={oldPw}
                    onChange={(e) => setOldPw(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-800/80 bg-black/30 px-3 py-2 text-sm text-zinc-100"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-400">{t("admin.newPassword")}</span>
                  <input
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-800/80 bg-black/30 px-3 py-2 text-sm text-zinc-100"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-zinc-400">
                    {t("admin.confirmPassword")}
                  </span>
                  <input
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-zinc-800/80 bg-black/30 px-3 py-2 text-sm text-zinc-100"
                  />
                </label>
                {mgmtError ? <p className="text-xs text-red-400">{mgmtError}</p> : null}
                <button
                  type="submit"
                  disabled={mgmtLoading}
                  className="w-full rounded-xl border border-zinc-600 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-900 disabled:opacity-60"
                >
                  {mgmtLoading ? t("admin.saving") : t("admin.saveNewPassword")}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
