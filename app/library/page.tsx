"use client";

import { useTranslation } from "react-i18next";

export default function LibraryPage() {
  const { t } = useTranslation();
  return (
    <main className="flex min-h-screen flex-col">
      <header className="px-4 pt-4">
        <h1 className="text-base font-semibold text-zinc-100">
          {t("library.title")}
        </h1>
        <p className="mt-1 text-xs text-zinc-400">{t("library.subtitle")}</p>
      </header>
      <div className="flex-1 px-4 pb-24 pt-3">
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-4">
          <p className="text-sm text-zinc-200">{t("libraryPage.placeholderTitle")}</p>
          <p className="mt-1 text-xs text-zinc-400">
            {t("libraryPage.placeholderSubtitle")}
          </p>
        </div>
      </div>
    </main>
  );
}
