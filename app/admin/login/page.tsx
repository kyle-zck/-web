"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { ADMIN_TAB_SESSION_KEY } from "@/lib/admin/tab-session";

export default function AdminLoginPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    const tid = window.setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch("/admin/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
        credentials: "include",
        signal: ctrl.signal
      });
      if (!res.ok) {
        setError(t("common.admin.invalidKey"));
        return;
      }
      try {
        sessionStorage.setItem(ADMIN_TAB_SESSION_KEY, "1");
      } catch {
        /* private mode 等 */
      }
      router.replace("/admin");
      router.refresh();
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setError(
          t("common.admin.requestTimeout", "Request timed out. Check your network and try again.")
        );
      } else {
        setError(t("common.admin.networkError"));
      }
    } finally {
      window.clearTimeout(tid);
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black px-4">
      <div className="mx-auto max-w-md pt-10">
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-6">
          <p className="text-sm font-semibold text-zinc-100">{t("common.admin.adminLogin")}</p>
          <p className="mt-1 text-xs text-zinc-400">{t("common.admin.loginHint")}</p>

          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-zinc-400">{t("common.admin.adminKey")}</span>
              <input
                type="password"
                autoComplete="current-password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={t("common.admin.enterKey")}
                className="mt-1 w-full rounded-2xl border border-zinc-800/80 bg-black/30 px-4 py-3 text-sm font-semibold text-zinc-100 outline-none ring-0 focus:border-brand/60"
              />
            </label>

            {error ? (
              <p className="text-xs text-red-400">{error}</p>
            ) : (
              <p className="text-[11px] leading-5 text-zinc-500">{t("common.admin.keyHint")}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-soft-glow disabled:opacity-70"
            >
              {loading ? t("common.admin.checking") : t("common.admin.login")}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
