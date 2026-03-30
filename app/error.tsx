"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();

  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-lg font-bold text-white">{t("common.error.title", "Something went wrong")}</p>
      <p className="max-w-md text-sm text-zinc-400">
        {error?.message || t("common.error.message", "An error occurred. Please try again or refresh the page.")}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      >
        {t("common.error.retry", "Retry")}
      </button>
    </div>
  );
}
