"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { GoogleTranslateWidget } from "@/components/translate/google-translate-widget";

const LANG_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "English", value: "en" },
  { label: "中文", value: "zh-CN" },
  { label: "Español", value: "es" },
  { label: "Français", value: "fr" },
  { label: "Deutsch", value: "de" },
  { label: "日本語", value: "ja" },
  { label: "한국어", value: "ko" }
];

function SearchIcon() {
  return (
    <span aria-hidden="true" className="text-lg leading-none">
      ⌕
    </span>
  );
}

function NavIcon({
  label,
  active,
  onClick,
  href
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const text = active ? "text-brand" : "text-zinc-400";
  const iconBase = "h-5 w-5";

  const icon = (() => {
    if (label === "Home") return <span className={`${iconBase} ${text}`}>⌂</span>;
    if (label === "Search") return <span className={`${iconBase} ${text}`}>⌕</span>;
    if (label === "Library") return <span className={`${iconBase} ${text}`}>☰</span>;
    if (label === "Profile") return <span className={`${iconBase} ${text}`}>☺</span>;
    return <span className={`${iconBase} ${text}`}>●</span>;
  })();

  const cls = `flex flex-1 flex-col items-center gap-0.5 text-[11px] ${text}`;

  if (href) {
    return (
      <Link href={href} className={cls} aria-label={label}>
        {icon}
        <span className="leading-none">{label}</span>
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cls} aria-label={label}>
      {icon}
      <span className="leading-none">{label}</span>
    </button>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [lang, setLang] = useState("en");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const hidden = useMemo(() => pathname.startsWith("/admin"), [pathname]);

  useEffect(() => {
    // Rough default: map browser locale to our select values
    const locale =
      typeof navigator !== "undefined" ? navigator.language : undefined;
    if (!locale) return;
    if (locale.startsWith("zh")) setLang("zh-CN");
    else if (locale.startsWith("es")) setLang("es");
    else if (locale.startsWith("fr")) setLang("fr");
    else if (locale.startsWith("de")) setLang("de");
    else if (locale.startsWith("ja")) setLang("ja");
    else if (locale.startsWith("ko")) setLang("ko");
    else setLang("en");
  }, []);

  if (hidden) return null;

  const onSubmit = () => {
    const query = q.trim();
    setOpen(false);
    if (!query) {
      router.push("/explore");
      return;
    }
    const params = new URLSearchParams({ q: query });
    router.push(`/explore?${params.toString()}`);
  };

  return (
    <>
      <div className="sticky top-0 z-50 border-b border-zinc-800/60 bg-black/75 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-2">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/15 ring-1 ring-brand/40">
                <span className="text-base font-extrabold text-brand">R</span>
              </div>
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-extrabold text-zinc-100">ReelShort</p>
                <p className="text-[11px] text-zinc-400">Every Second Is Drama</p>
              </div>
            </Link>

            {/* Desktop: integrate icon+text navigation (Home/Search/Library/Profile) */}
            <nav className="hidden flex-1 md:flex">
              <div className="flex w-full items-center justify-center gap-2 rounded-full bg-black/20 px-2 py-1 ring-1 ring-zinc-800/60">
                <NavIcon
                  label="Home"
                  href="/"
                  active={pathname === "/"}
                />
                <NavIcon
                  label="Search"
                  onClick={() => setOpen(true)}
                  active={false}
                />
                <NavIcon
                  label="Library"
                  href="/library"
                  active={pathname.startsWith("/library")}
                />
                <NavIcon
                  label="Profile"
                  href="/profile"
                  active={pathname.startsWith("/profile")}
                />
              </div>
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="hidden items-center gap-2 rounded-full bg-black/40 px-3 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-zinc-800/80 hover:text-white md:flex"
            >
              <SearchIcon />
              <span>Search</span>
            </button>

            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 ring-1 ring-zinc-800/80 md:hidden"
              aria-label="Search"
            >
              <SearchIcon />
            </button>

            <div className="hidden items-center gap-2 md:flex">
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value)}
                className="rounded-full bg-black/40 px-3 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-zinc-800/80 outline-none"
                aria-label="Language"
              >
                {LANG_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Search overlay */}
      {open ? (
        <div className="fixed inset-0 z-[60] bg-black/60">
          <div className="mx-auto mt-16 w-[calc(100%-2rem)] max-w-md rounded-3xl border border-zinc-800/80 bg-zinc-950 p-4 shadow-soft-glow">
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by drama name or description..."
                className="flex-1 rounded-2xl border border-zinc-800/80 bg-black/30 px-4 py-3 text-sm font-semibold text-zinc-100 outline-none focus:border-brand/60"
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSubmit();
                }}
              />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-10 w-10 rounded-full bg-black/30 ring-1 ring-zinc-800/80 text-zinc-200"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <p className="text-xs text-zinc-400">Language</p>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="rounded-full bg-black/30 px-3 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-zinc-800/80 outline-none"
                >
                  {LANG_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={onSubmit}
                className="rounded-2xl bg-brand px-4 py-3 text-sm font-extrabold text-white shadow-soft-glow"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Google translate widget - hidden container */}
      <GoogleTranslateWidget language={lang} />
    </>
  );
}

