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
  const { isLoggedIn, email, userId, signInWithEmail, signUpWithEmail } = useUserStore();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [signupPendingVerify, setSignupPendingVerify] = useState(false);
  const { t } = useTranslation();

  const displayEmail = email ?? userId ?? "";

  const mapError = (code: string | undefined) => {
    if (code === "not_configured") return t("auth.notConfigured");
    return code ?? "";
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSignupPendingVerify(false);
    const emailTrim = emailInput.trim();
    if (!emailTrim || !passwordInput) {
      setFormError(t("auth.email") + " / " + t("auth.password"));
      return;
    }
    setBusy(true);
    try {
      if (tab === "signin") {
        const { error } = await signInWithEmail(emailTrim, passwordInput);
        if (error) setFormError(mapError(error));
        else onClose();
      } else {
        const { error, needsEmailConfirmation } = await signUpWithEmail(emailTrim, passwordInput);
        if (error) setFormError(mapError(error));
        else if (needsEmailConfirmation) setSignupPendingVerify(true);
        else onClose();
      }
    } finally {
      setBusy(false);
    }
  };

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
              onClick={() => {
                setTab("signin");
                setFormError(null);
                setSignupPendingVerify(false);
              }}
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
              onClick={() => {
                setTab("signup");
                setFormError(null);
                setSignupPendingVerify(false);
              }}
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
          {displayEmail
            ? t("auth.loggedInAs", { email: displayEmail })
            : t("auth.loggedInDemo")}
        </p>
      ) : signupPendingVerify ? (
        <p className="text-sm text-zinc-300">{t("auth.signupCheckEmail")}</p>
      ) : (
        <>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">{t("auth.email")}</label>
              <input
                type="email"
                autoComplete="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-black/50 px-3 py-2 text-sm text-zinc-100 outline-none ring-brand/40 focus:border-brand/60 focus:ring-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400">
                {t("auth.password")}
              </label>
              <input
                type="password"
                autoComplete={tab === "signin" ? "current-password" : "new-password"}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-black/50 px-3 py-2 text-sm text-zinc-100 outline-none ring-brand/40 focus:border-brand/60 focus:ring-2"
              />
            </div>
            {formError ? (
              <p className="text-xs text-red-400/90" role="alert">
                {formError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {busy ? t("auth.working") : tab === "signin" ? t("auth.submitSignIn") : t("auth.submitSignUp")}
            </button>
          </form>

          <p className="mt-4 text-xs text-zinc-500">{t("auth.socialDemo")}</p>
          <div className="mt-2 space-y-2">
            <SocialButton provider="google" label={t("auth.continueGoogle")} />
            <SocialButton provider="facebook" label={t("auth.continueFacebook")} />
            <SocialButton provider="apple" label={t("auth.continueApple")} />
          </div>
          <p className="mt-3 text-[11px] leading-5 text-zinc-500">{t("auth.note")}</p>
        </>
      )}
    </Modal>
  );
}
