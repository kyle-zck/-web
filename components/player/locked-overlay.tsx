"use client";

import { useTranslation } from "react-i18next";

interface LockedOverlayProps {
  onUnlock: () => void;
}

export function LockedOverlay({ onUnlock }: LockedOverlayProps) {
  const { t } = useTranslation();

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
      style={{ pointerEvents: "auto" }}
    >
      <div className="flex flex-col items-center gap-6 px-6">
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-white/90"
          aria-hidden
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <p className="text-center text-lg font-bold text-white">
          {t("locked.paidMessage", "This is a paid episode. Please unlock to watch.")}
        </p>
        <button
          type="button"
          onClick={onUnlock}
          className="rounded-xl bg-brand px-8 py-3 text-base font-semibold text-white shadow-lg transition-colors hover:bg-red-600"
        >
          {t("locked.unlockNow", "Unlock Now")}
        </button>
      </div>
    </div>
  );
}
