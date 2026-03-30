"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

function Icon({ name, active }: { name: string; active: boolean }) {
  const base = "h-5 w-5";
  const common = active ? "text-brand" : "text-zinc-400";
  switch (name) {
    case "home":
      return <span className={cn(base, common)}>⌂</span>;
    case "search":
      return <span className={cn(base, common)}>⌕</span>;
    case "user":
      return <span className={cn(base, common)}>☺</span>;
    default:
      return null;
  }
}

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const items = [
    { href: "/", label: t("common.nav.home", "Home"), icon: "home" },
    { href: "/explore", label: t("common.nav.explore", "Explore"), icon: "search" },
    { href: "/profile", label: t("common.nav.profile", "My"), icon: "user" }
  ];

  return (
    <nav className="sticky bottom-0 z-40 border-t border-zinc-800/80 bg-black/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="page-gutter-x mx-auto flex max-w-md items-center justify-between py-2.5">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 text-[11px]",
                active ? "text-brand" : "text-zinc-400"
              )}
            >
              <Icon name={item.icon} active={active} />
              <span className="leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
