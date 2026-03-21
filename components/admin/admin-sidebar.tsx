"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAppLanguage } from "@/components/i18n/I18nProvider";
import { cn } from "@/lib/utils";

const NAV_KEYS = [
  { href: "/admin", key: "dashboard" },
  { href: "/admin/series", key: "seriesManagement" },
  { href: "/admin/config", key: "subscriptionConfig" },
  { href: "/admin/users", key: "usersAndUid" },
  { href: "/admin/recharge", key: "rechargeRecords" },
  { href: "/admin/history", key: "watchHistory" },
  { href: "/admin/favorites", key: "userFavorites" },
  { href: "/admin/likes", key: "userLikes" }
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { lang, setLanguage, languageOptions } = useAppLanguage();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-zinc-800/80 bg-black/40 p-4 backdrop-blur md:flex">
      <div className="flex items-center gap-2 px-2">
        <div className="h-9 w-9 rounded-xl bg-brand/15 ring-1 ring-brand/40" />
        <div>
          <p className="text-sm font-semibold text-zinc-100">{t("admin.cms")}</p>
          <p className="text-[11px] text-zinc-400">{t("admin.internalDashboard")}</p>
        </div>
      </div>
      <nav className="mt-5 space-y-1 px-2">
        {NAV_KEYS.map((item) => {
          const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-2xl px-3 py-2 text-sm font-semibold ring-1 ring-transparent transition",
                active
                  ? "bg-brand/15 text-brand ring-brand/40"
                  : "text-zinc-300 hover:bg-zinc-900/60 hover:ring-zinc-800/80"
              )}
            >
              {t(`admin.${item.key}`)}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 px-2 pt-5">
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

