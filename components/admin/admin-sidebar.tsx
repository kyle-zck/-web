"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/series", label: "Series Management" },
  { href: "/admin/config", label: "Subscription Config" },
  { href: "/admin/users", label: "Users & UID" },
  { href: "/admin/recharge", label: "Recharge Records" },
  { href: "/admin/history", label: "Watch History" },
  { href: "/admin/favorites", label: "User Favorites" },
  { href: "/admin/likes", label: "User Likes" }
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-zinc-800/80 bg-black/40 p-4 backdrop-blur md:flex">
      <div className="flex items-center gap-2 px-2">
        <div className="h-9 w-9 rounded-xl bg-brand/15 ring-1 ring-brand/40" />
        <div>
          <p className="text-sm font-semibold text-zinc-100">Admin CMS</p>
          <p className="text-[11px] text-zinc-400">Internal Dashboard</p>
        </div>
      </div>
      <nav className="mt-5 space-y-1 px-2">
        {NAV.map((item) => {
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
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-2 pt-5">
        <p className="text-[11px] leading-5 text-zinc-500">
          Security: /admin requires cookie auth (demo).
        </p>
      </div>
    </aside>
  );
}

