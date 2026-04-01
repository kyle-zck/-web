"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppLanguage } from "@/components/i18n/I18nProvider";
import { usePlayerStore } from "@/lib/store/player";
import { useUserStore } from "@/lib/store/user";
import type { AppConfig } from "@/lib/app-config/types";
import { getOrCreateDeviceClientId } from "@/lib/client/device-client-id";

interface RechargeRecordLite {
  id: string;
  tier: string;
  remainingDays?: number;
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 5000, signal?: AbortSignal): Promise<T> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store"
    });
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function SearchGlyph() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M10.5 18.5C14.9183 18.5 18.5 14.9183 18.5 10.5C18.5 6.08172 14.9183 2.5 10.5 2.5C6.08172 2.5 2.5 6.08172 2.5 10.5C2.5 14.9183 6.08172 18.5 10.5 18.5Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M21 21L16.65 16.65"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BurgerGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 17H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function TopNavV2() {
  const pathname = usePathname();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { lang, setLanguage, languageOptions } = useAppLanguage();

  const { isSubscribed, getDaysRemaining, setSubscribed } = usePlayerStore();
  const { isLoggedIn, userId, supabaseUserId } = useUserStore();

  const hidden = useMemo(() => pathname.startsWith("/admin"), [pathname]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [userHover, setUserHover] = useState(false);
  const [brandName, setBrandName] = useState("ReelShorts");
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [navFlags, setNavFlags] = useState<AppConfig["nav"] | undefined>(undefined);

  const uidDisplay = isLoggedIn ? userId ?? "—" : "—";

  useEffect(() => {
    const ctrl = new AbortController();
    fetchJsonWithTimeout<AppConfig>("/api/app-config", 5000, ctrl.signal)
      .then((json: AppConfig) => {
        if (json?.brandName) setBrandName(json.brandName);
        setLogoUrl(json.logoUrl?.trim() || undefined);
        setNavFlags(json.nav);
      })
      .catch(() => {
        // ignore
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    const clientId = supabaseUserId ?? getOrCreateDeviceClientId();
    if (!clientId) return;
    let disposed = false;
    let lastRunAt = 0;

    const refresh = (reason: "mount" | "focus" | "visible") => {
      const now = Date.now();
      // 防止频繁触发（focus/visibility 可能连发）
      if (reason !== "mount" && now - lastRunAt < 3000) return;
      lastRunAt = now;

      const ctrl = new AbortController();
      fetchJsonWithTimeout<{ records?: RechargeRecordLite[] }>(
        `/api/user/recharge?clientId=${encodeURIComponent(clientId)}`,
        6000,
        ctrl.signal
      )
        .then((json) => {
          if (disposed) return;
          const list = (json?.records ?? []) as RechargeRecordLite[];
          if (!Array.isArray(list) || list.length === 0) {
            setSubscribed(false);
            return;
          }
          const active = list
            .map((x) => ({
              tier: x.tier,
              remainingDays: Number.isFinite(Number(x.remainingDays)) ? Number(x.remainingDays) : 0
            }))
            .sort((a, b) => b.remainingDays - a.remainingDays)[0];
          if (!active || active.remainingDays <= 0) {
            setSubscribed(false);
            return;
          }
          setSubscribed(true, active.remainingDays, active.tier || "VIP");
        })
        .catch(() => {
          // ignore
        });
    };

    refresh("mount");

    const onFocus = () => refresh("focus");
    const onVis = () => {
      if (document.visibilityState === "visible") refresh("visible");
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    const timer = window.setInterval(() => refresh("visible"), 60_000);

    return () => {
      disposed = true;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(timer);
    };
  }, [supabaseUserId, setSubscribed]);

  const navItems = useMemo(() => {
    const showExplore = navFlags?.showExplore !== false;
    const showProfile = navFlags?.showProfile !== false;
    return [
      { href: "/", label: t("common.nav.home"), active: pathname === "/", show: true as const },
      {
        href: "/explore",
        label: t("common.nav.explore"),
        active: pathname.startsWith("/explore"),
        show: showExplore
      },
      {
        href: "/profile",
        label: t("common.nav.profile"),
        active: pathname.startsWith("/profile"),
        show: showProfile
      }
    ].filter((it) => it.show);
  }, [t, pathname, navFlags]);

  const closeAll = () => {
    setSearchOpen(false);
    setMenuOpen(false);
  };

  const submitSearch = () => {
    const query = q.trim();
    if (!query) {
      closeAll();
      router.push("/explore");
      return;
    }
    closeAll();
    const params = new URLSearchParams({ q: query });
    router.push(`/explore?${params.toString()}`);
  };

  if (hidden) return null;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-zinc-800/70 bg-black/70 backdrop-blur-md">
        <div className="page-gutter-x mx-auto flex max-w-[1400px] items-center justify-between gap-4 py-3 sm:gap-6 sm:py-4">
          {/* 左侧：Logo + 品牌名 + 中部菜单 */}
          <div className="flex flex-1 items-center gap-8">
            <Link href="/" className="flex items-center gap-2 sm:gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-zinc-600 sm:h-12 sm:w-12 lg:h-14 lg:w-14"
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand via-red-600 to-brand ring-2 ring-zinc-600 sm:h-12 sm:w-12 lg:h-14 lg:w-14">
                  <span className="text-2xl font-extrabold leading-none text-white sm:text-3xl lg:text-4xl">
                    Rs
                  </span>
                </div>
              )}
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[clamp(1rem,0.85rem+0.5vw,1.75rem)] font-bold leading-tight text-white sm:max-w-[200px] lg:max-w-[260px]">
                  {brandName}
                </p>
              </div>
            </Link>

            {/* Middle nav (desktop) */}
            <nav className="hidden flex-1 items-center justify-between gap-12 md:flex px-4">
              {navItems.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => closeAll()}
                  className={[
                    "whitespace-nowrap text-lg font-bold transition-colors pb-1 border-b-2",
                    it.active
                      ? "text-[#EE2737] border-[#EE2737]"
                      : "text-white border-transparent hover:text-white hover:border-zinc-600"
                  ].join(" ")}
                >
                  {it.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* 右侧：搜索 / 语言 / 头像 */}
          <div className="flex flex-1 items-center justify-end gap-4">
            {/* Mobile: hamburger menu */}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 ring-1 ring-zinc-700 text-zinc-200 md:hidden"
              aria-label="Menu"
            >
              <BurgerGlyph />
            </button>

            <button
              type="button"
              onClick={() => {
                setSearchOpen(true);
                setMenuOpen(false);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 ring-1 ring-zinc-700 text-zinc-200"
              aria-label={t("common.nav.search")}
            >
              <SearchGlyph />
            </button>

            <div className="hidden items-center md:flex">
              <select
                value={lang}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="rounded-full bg-black/60 px-4 py-2 text-base font-semibold text-zinc-100 ring-1 ring-zinc-700 outline-none"
                aria-label="Language"
              >
                {languageOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div
              className="relative hidden items-center md:flex"
              onMouseEnter={() => setUserHover(true)}
              onMouseLeave={() => setUserHover(false)}
            >
              {/* <a> 内不可嵌套 <button>，否则点击无导航 */}
              <Link
                href="/profile"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-black/70 ring-1 ring-zinc-700 transition-colors hover:bg-zinc-800/80"
                aria-label={t("common.nav.profile")}
              >
                <span className="text-lg" aria-hidden>
                  👤
                </span>
              </Link>

              {userHover ? (
                <div className="absolute right-0 top-11 w-[320px] rounded-2xl border border-zinc-800 bg-black/95 p-4 shadow-xl shadow-black/70">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 ring-1 ring-zinc-700">
                      <span className="text-xl">👤</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {isLoggedIn ? t("common.profile.user") : t("common.profile.guest")}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-400">
                        {t("common.uidLabel")} {uidDisplay}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-black/40 p-3">
                      <p className="text-[11px] font-semibold text-zinc-400">
                        {t("common.subscription.status")}
                      </p>
                      <p className="mt-2 text-xl font-extrabold text-white">
                        {isSubscribed ? t("common.subscription.active") : t("common.subscription.inactive")}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-black/40 p-3">
                      <p className="text-[11px] font-semibold text-zinc-400">
                        {t("common.subscription.daysRemaining")}
                      </p>
                      <p className="mt-2 text-xl font-extrabold text-white">{getDaysRemaining()}</p>
                    </div>
                  </div>

                  <Link
                    href="/store"
                    className="mt-4 block w-full rounded-full bg-[#EE2737] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-red-500"
                  >
                    {t("common.profile.toStore")}
                  </Link>
                </div>
              ) : null}
            </div>

            {/* Mobile user avatar */}
            <div className="md:hidden">
              <Link
                href="/profile"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 ring-1 ring-zinc-700"
                aria-label={t("common.nav.profile")}
              >
                <span className="text-lg" aria-hidden>
                  👤
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen ? (
          <div className="border-t border-zinc-800/60 bg-black/85 px-4 py-3 md:hidden">
            <div className="flex flex-col gap-2">
              {navItems.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => closeAll()}
                  className="rounded-2xl px-3 py-2 text-sm font-semibold text-zinc-300 ring-1 ring-zinc-800/80 hover:text-brand hover:bg-brand/10"
                >
                  {it.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      {/* Search modal (no language inside) */}
      {searchOpen ? (
        <div className="fixed inset-0 z-[60] bg-black/60">
          <div className="mx-auto mt-16 w-[calc(100%-2rem)] max-w-xl rounded-3xl border border-zinc-800/80 bg-zinc-950 p-4 shadow-soft-glow">
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-full border border-brand/30 bg-black/20 px-4 py-3">
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("common.search.placeholder")}
                  className="w-full bg-transparent text-sm font-semibold text-zinc-100 outline-none placeholder:text-zinc-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitSearch();
                  }}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                }}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-black/20 ring-1 ring-zinc-800/80 text-zinc-200"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={submitSearch}
                className="rounded-full bg-brand px-6 py-3 text-sm font-extrabold text-white shadow-soft-glow"
              >
                {t("common.search.button")}
              </button>
              <p className="text-[11px] text-zinc-400">{t("common.search.help")}</p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

