"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserStore } from "@/lib/store/user";
import { useTranslation } from "react-i18next";
import type { AppConfig } from "@/lib/app-config/types";

async function fetchAppConfig(): Promise<Partial<AppConfig> | null> {
  try {
    const res = await fetch("/api/app-config", { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path fillRule="evenodd" clipRule="evenodd" d="M18 9a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" fill="#1877F2"/>
      <path fillRule="evenodd" clipRule="evenodd" d="M11.793 9.504V13.5h2.25L14.5 9H11.793V7.312c0-.938.375-1.688 1.75-1.688H14.5V4.5h-1.781c-2.094 0-3.5 1.219-3.5 3.438V9.504H7V13.5h2.793V18h2.25v-8.496h.75z" fill="#fff"/>
    </svg>
  );
}

function SocialButton({
  provider,
  label,
  icon
}: {
  provider: "google" | "facebook";
  label: string;
  icon: React.ReactNode;
}) {
  const { signInWithOAuth } = useUserStore();
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation();

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const { error } = await signInWithOAuth(provider);
        setBusy(false);
        if (error === "not_configured") {
          window.alert(t("common.auth.notConfigured"));
        } else if (error) {
          window.alert(error);
        }
      }}
      className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:border-white/25 hover:bg-white/10 disabled:opacity-50"
    >
      <span className="shrink-0">{icon}</span>
      {busy ? t("common.auth.working") : label}
    </button>
  );
}

export function AuthModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { isLoggedIn, email, userId } = useUserStore();
  const { t } = useTranslation();
  const [brandName, setBrandName] = useState("ReelShorts");
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  const displayEmail = email ?? userId ?? "";

  useEffect(() => {
    setMounted(true);
    fetchAppConfig().then((cfg) => {
      if (cfg) {
        if (cfg.brandName) setBrandName(cfg.brandName);
        setLogoUrl(cfg.logoUrl?.trim() || undefined);
      }
    });
  }, []);

  if (!open || !mounted) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overscroll-none">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
        aria-hidden
      />

      {/* Card */}
      <div
        className="relative z-10 mx-4 w-full max-w-sm rounded-3xl border border-white/10 bg-black/70 p-6 shadow-2xl shadow-black/60 backdrop-blur-xl"
        role="dialog"
        aria-modal="true"
        aria-label={t("common.auth.signinTitle")}
      >
        {/* Close */}
        <button
          type="button"
          aria-label={t("common.close")}
          onClick={onClose}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-zinc-400 transition-colors hover:bg-white/20 hover:text-white"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Logo + Brand */}
        <div className="flex flex-col items-center pt-2 pb-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand via-red-600 to-brand ring-2 ring-white/10">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="h-10 w-10 rounded-xl object-cover"
              />
            ) : (
              <span className="text-3xl font-extrabold leading-none text-white">Rs</span>
            )}
          </div>
          <p className="mt-3 text-xl font-bold text-white">{brandName}</p>
        </div>

        {/* Content */}
        {isLoggedIn ? (
          <p className="text-center text-sm text-zinc-400">
            {displayEmail
              ? t("common.auth.loggedInAs", { email: displayEmail })
              : t("common.auth.loggedInDemo")}
          </p>
        ) : (
          <>
            <div className="space-y-2.5">
              <SocialButton
                provider="google"
                label={t("common.auth.continueGoogle")}
                icon={<GoogleIcon />}
              />
              <SocialButton
                provider="facebook"
                label={t("common.auth.continueFacebook")}
                icon={<FacebookIcon />}
              />
            </div>

            <p className="mt-5 text-center text-[11px] leading-relaxed text-zinc-500">
              By continuing. I agree to this{" "}
              <Link
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 text-zinc-400 hover:text-white hover:underline"
                onClick={onClose}
              >
                Service agreement
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 text-zinc-400 hover:text-white hover:underline"
                onClick={onClose}
              >
                Privacy policy
              </Link>
              .
            </p>

            {/* Later */}
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm font-semibold text-zinc-400 transition-colors hover:border-white/10 hover:bg-white/10 hover:text-zinc-200"
            >
              {t("common.auth.later")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
