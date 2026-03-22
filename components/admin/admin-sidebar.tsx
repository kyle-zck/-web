"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppLanguage } from "@/components/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { ADMIN_TAB_SESSION_KEY } from "@/lib/admin/tab-session";

const DRAMA_MENU = [
  { href: "/admin/series/upload", key: "dramaUpload" },
  { href: "/admin/series/detail", key: "dramaDetail" },
  { href: "/admin/series/episodes", key: "episodeManagement" },
  { href: "/admin/series/tags", key: "tagLibrary" },
  { href: "/admin/distribution", key: "distributionCenter" }
];

const OTHER_NAV = [
  { href: "/admin", key: "dashboard" },
  { href: "/admin/site", key: "siteSettings" },
  { href: "/admin/config", key: "subscriptionConfig" },
  { href: "/admin/security", key: "securityPassword" },
  { href: "/admin/users", key: "usersAndUid" },
  { href: "/admin/recharge", key: "rechargeRecords" },
  { href: "/admin/history", key: "watchHistory" },
  { href: "/admin/favorites", key: "userFavorites" },
  { href: "/admin/likes", key: "userLikes" },
  { href: "/admin/views", key: "userViews" }
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useTranslation();
  const { lang, setLanguage, languageOptions } = useAppLanguage();
  const [dramaOpen, setDramaOpen] = useState(
    pathname.startsWith("/admin/series") || pathname.startsWith("/admin/distribution")
  );

  const isDramaActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const isOtherActive = (href: string) =>
    href === "/admin" ? pathname === href : pathname.startsWith(href);

  const onLogout = async () => {
    try {
      sessionStorage.removeItem(ADMIN_TAB_SESSION_KEY);
    } catch {
      /* ignore */
    }
    try {
      await fetch("/admin/api/logout", { method: "POST", credentials: "include" });
    } catch {
      /* ignore */
    }
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-zinc-800/80 bg-zinc-950/80 p-4 backdrop-blur md:flex">
      <div className="flex items-center gap-2 px-2">
        <div className="h-9 w-9 rounded-xl bg-brand/15 ring-1 ring-brand/40" />
        <div>
          <p className="text-sm font-semibold text-zinc-100">{t("admin.cms")}</p>
          <p className="text-[11px] text-zinc-400">{t("admin.internalDashboard")}</p>
        </div>
      </div>

      <nav className="mt-5 flex-1 space-y-1 overflow-y-auto px-2">
        {/* 剧目管理 - 可折叠 */}
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setDramaOpen(!dramaOpen)}
            className={cn(
              "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold ring-1 ring-transparent transition",
              dramaOpen || DRAMA_MENU.some((m) => isDramaActive(m.href))
                ? "bg-brand/10 text-brand ring-brand/30"
                : "text-zinc-300 hover:bg-zinc-900/60 hover:ring-zinc-800/80"
            )}
          >
            {t("admin.dramaManagement")}
            <svg
              className={cn("h-4 w-4 transition-transform", dramaOpen && "rotate-180")}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {dramaOpen && (
            <div className="ml-3 mt-1 space-y-0.5 border-l border-zinc-800/80 pl-3">
              {DRAMA_MENU.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-xl px-3 py-2 text-sm font-medium transition",
                    isDramaActive(item.href)
                      ? "bg-brand/15 text-brand"
                      : "text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200"
                  )}
                >
                  {t(`admin.${item.key}`)}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 其他菜单 */}
        <div className="mt-4 border-t border-zinc-800/60 pt-4">
          {OTHER_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-2xl px-3 py-2 text-sm font-semibold ring-1 ring-transparent transition",
                isOtherActive(item.href)
                  ? "bg-brand/15 text-brand ring-brand/40"
                  : "text-zinc-300 hover:bg-zinc-900/60 hover:ring-zinc-800/80"
              )}
            >
              {t(`admin.${item.key}`)}
            </Link>
          ))}
        </div>
      </nav>

      <div className="mt-auto space-y-3 border-t border-zinc-800/60 px-2 pt-5">
        <button
          type="button"
          onClick={onLogout}
          className="w-full rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/20"
        >
          {t("admin.logout")}
        </button>
        <select
          value={lang}
          onChange={(e) => setLanguage(e.target.value as "en" | "zh-CN")}
          className="w-full rounded-lg border border-zinc-600 bg-zinc-900/60 px-3 py-2 text-xs font-medium text-zinc-200 outline-none"
        >
          {languageOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="text-[11px] leading-5 text-zinc-500">
          {t("admin.securityNote")}
        </p>
      </div>
    </aside>
  );
}
