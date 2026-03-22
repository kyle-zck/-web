"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "首页", icon: "home" },
  { href: "/explore", label: "探索", icon: "search" },
  { href: "/profile", label: "我的", icon: "user" }
];

function Icon({ name, active }: { name: string; active: boolean }) {
  const base = "h-5 w-5";
  const common = active ? "text-brand" : "text-zinc-400";
  switch (name) {
    case "home":
      return (
        <span className={cn(base, common)}>⌂</span>
      );
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

  return (
    <nav className="sticky bottom-0 z-40 border-t border-zinc-800/80 bg-black/95 backdrop-blur md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="page-gutter-x mx-auto flex max-w-md items-center justify-between py-2.5">
        {ITEMS.map((item) => {
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
