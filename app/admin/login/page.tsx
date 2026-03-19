"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/admin/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key })
      });
      if (!res.ok) {
        setError("Invalid admin key (demo).");
        return;
      }
      router.push("/admin");
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black px-4">
      <div className="mx-auto max-w-md pt-10">
        <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/60 p-6">
          <p className="text-sm font-semibold text-zinc-100">Admin Login</p>
          <p className="mt-1 text-xs text-zinc-400">
            Demo: set cookie required for /admin routes.
          </p>

          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-zinc-400">Admin Key</span>
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter key"
                className="mt-1 w-full rounded-2xl border border-zinc-800/80 bg-black/30 px-4 py-3 text-sm font-semibold text-zinc-100 outline-none ring-0 focus:border-brand/60"
              />
            </label>

            {error ? (
              <p className="text-xs text-red-400">{error}</p>
            ) : (
              <p className="text-[11px] leading-5 text-zinc-500">
                If you don&apos;t have an env var, default expected key is `admin`.
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white shadow-soft-glow disabled:opacity-70"
            >
              {loading ? "Checking..." : "Login"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

