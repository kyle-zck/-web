"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

export function MoreMoviesLink() {
  const { t } = useTranslation();

  return (
    <Link
      href="/explore"
      className="mx-auto block max-w-xs rounded-2xl border border-zinc-800/80 bg-black/30 px-6 py-3 text-center text-sm font-semibold text-zinc-200 hover:border-brand/60"
    >
      {t("home.moreMoviesCta")}
    </Link>
  );
}

