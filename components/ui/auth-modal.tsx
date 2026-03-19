"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { useUserStore } from "@/lib/store/user";
import { useTranslation } from "react-i18next";

function SocialButton({
  provider,
  label
}: {
  provider: "google" | "facebook" | "apple";
  label: string;
}) {
  const { loginWithSocial } = useUserStore();

  return (
    <button
      type="button"
      onClick={() => loginWithSocial(provider)}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-800/80 bg-black/40 px-4 py-3 text-sm font-semibold text-zinc-100 hover:border-brand/60"
    >
      <span className="text-base">●</span>
      {label}
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
  const { isLoggedIn } = useUserStore();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={tab === "signin" ? t("auth.signinTitle") : t("auth.signupTitle")}
      footer={
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <button
              type="button"
              className={
                tab === "signin"
                  ? "text-sm font-semibold text-brand"
                  : "text-sm font-semibold text-zinc-400"
              }
              onClick={() => setTab("signin")}
            >
              {t("auth.signinTab")}
            </button>
            <button
              type="button"
              className={
                tab === "signup"
                  ? "text-sm font-semibold text-brand"
                  : "text-sm font-semibold text-zinc-400"
              }
              onClick={() => setTab("signup")}
            >
              {t("auth.signupTab")}
            </button>
          </div>
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
          {t("auth.loggedInDemo")}
        </p>
      ) : (
        <>
          <p className="text-sm text-zinc-300">
            {t("auth.socialDemo")}
          </p>
          <div className="mt-3 space-y-2">
            <SocialButton provider="google" label={t("auth.continueGoogle")} />
            <SocialButton
              provider="facebook"
              label={t("auth.continueFacebook")}
            />
            <SocialButton provider="apple" label={t("auth.continueApple")} />
          </div>
          <p className="mt-3 text-[11px] leading-5 text-zinc-500">
            {t("auth.note")}
          </p>
        </>
      )}
    </Modal>
  );
}

