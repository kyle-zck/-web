"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useUserStore } from "@/lib/store/user";
import { useTranslation } from "react-i18next";

function SocialButton({
  provider,
  label
}: {
  provider: "google" | "facebook";
  label: string;
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
          window.alert(t("auth.notConfigured"));
        } else if (error) {
          window.alert(error);
        }
      }}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-800/80 bg-black/40 px-4 py-3 text-sm font-semibold text-zinc-100 hover:border-brand/60 disabled:opacity-50"
    >
      <span className="text-base">●</span>
      {busy ? t("auth.working") : label}
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

  const displayEmail = email ?? userId ?? "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("auth.signinTitle")}
      footer={
        <div className="flex items-center justify-between">
          <div />
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-zinc-300 hover:text-zinc-100"
          >
            {t("auth.later")}
          </button>
        </div>
      }
    >
      {isLoggedIn ? (
        <p className="text-sm text-zinc-300">
          {displayEmail
            ? t("auth.loggedInAs", { email: displayEmail })
            : t("auth.loggedInDemo")}
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-zinc-500">{t("auth.socialDemo")}</p>
          <div className="mt-3 space-y-2">
            <SocialButton provider="google" label={t("auth.continueGoogle")} />
            <SocialButton provider="facebook" label={t("auth.continueFacebook")} />
          </div>
          <p className="mt-3 text-[11px] leading-5 text-zinc-500">{t("auth.note")}</p>
        </>
      )}
    </Modal>
  );
}
