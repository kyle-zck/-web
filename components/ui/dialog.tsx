"use client";

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export function Dialog({
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
    <div className="fixed inset-0 z-50">
      <button
        aria-label={t("common.close", "Close")}
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md rounded-t-3xl border border-zinc-800/80 bg-zinc-950 p-4 shadow-soft-glow">
        <div className="flex items-start justify-between gap-3">
          <div>
            {title ? (
              <p className="text-sm font-semibold text-zinc-100">{title}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close", "Close")}
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full",
              "bg-zinc-900 text-zinc-300 ring-1 ring-zinc-800/80"
            )}
          >
            ✕
          </button>
        </div>
        <div className="mt-3">{children}</div>
        {footer ? <div className="mt-4">{footer}</div> : null}
      </div>
    </div>
  );
}

