"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface ShareSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  url: string;
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function ShareSheet({ open, onClose, title, url }: ShareSheetProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const shareMessages: Record<string, string> = {
    facebook: t("shareDrama", "Watch this amazing short drama now!"),
    twitter: `${title} — ${t("shareDrama", "Watch this amazing short drama now!")}`,
  };

  const handleFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer,width=600,height=500"
    );
    onClose();
  };

  const handleTwitter = () => {
    const text = encodeURIComponent(shareMessages.twitter ?? "");
    const u = encodeURIComponent(url);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${u}`, "_blank", "noopener,noreferrer,width=600,height=400");
    onClose();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 1200);
    } catch {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close share sheet"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="absolute inset-x-0 bottom-0 z-10">
        <div className="rounded-t-2xl border-t border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
          {/* Drag handle */}
          <div className="mb-5 flex justify-center">
            <div className="h-1 w-10 rounded-full bg-zinc-700" />
          </div>

          <p className="mb-5 text-sm font-semibold text-zinc-300">{t("seriesDetail.share")}</p>

          <div className="grid grid-cols-3 gap-4">
            {/* Facebook */}
            <button
              type="button"
              onClick={handleFacebook}
              className="flex flex-col items-center gap-2 rounded-xl bg-zinc-900 py-4 text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700"
            >
              <FacebookIcon />
              <span className="text-xs font-medium text-zinc-300">Facebook</span>
            </button>

            {/* Twitter / X */}
            <button
              type="button"
              onClick={handleTwitter}
              className="flex flex-col items-center gap-2 rounded-xl bg-zinc-900 py-4 text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700"
            >
              <TwitterIcon />
              <span className="text-xs font-medium text-zinc-300">X (Twitter)</span>
            </button>

            {/* Copy Link */}
            <button
              type="button"
              onClick={handleCopy}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl bg-zinc-900 py-4 text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700",
                copied && "bg-green-900/50"
              )}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
              <span className={cn("text-xs font-medium", copied ? "text-green-400" : "text-zinc-300")}>
                {copied ? t("common.seriesDetail.copiedLink") : t("common.copyLink")}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-xl border border-zinc-800 bg-zinc-900 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 active:bg-zinc-700"
          >
            {t("common.close", "Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
