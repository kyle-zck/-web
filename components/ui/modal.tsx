"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-none">
      <button
        type="button"
        aria-label={t("common.close", "Close")}
        className="fixed inset-0 bg-black/70"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative mx-auto w-[calc(100%-2rem)] max-w-4xl rounded-2xl",
          "my-8 border border-zinc-800/80 bg-black p-4 shadow-xl shadow-black/70",
          "max-h-[calc(100vh-4rem)] flex flex-col"
        )}
      >
        <button
          type="button"
          aria-label={t("common.close", "Close")}
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {title ? (
          <p className="text-base font-semibold text-white pr-10">{title}</p>
        ) : null}
        <div className="mt-3 flex-1 overflow-y-auto">{children}</div>
        {footer ? <div className="mt-4 shrink-0">{footer}</div> : null}
      </div>
    </div>
  );
}

