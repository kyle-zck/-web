"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CATEGORY_TAGS } from "@/constants/mock-data";
import { Badge } from "@/components/ui/badge";
import type { Series, CategoryTag } from "@/constants/mock-data";
import { useTranslation } from "react-i18next";
import type { AppLanguage } from "@/lib/i18n/languages";
import { getSeriesI18nText } from "@/lib/i18n/seriesText";
import { getTagKey } from "@/lib/i18n/tagKey";

function ExploreContent() {
  const searchParams = useSearchParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;

  const [series, setSeries] = useState<Series[]>([]);
  const qRaw = searchParams.get("q") ?? "";
  const q = qRaw.trim().toLowerCase();

  useEffect(() => {
    fetch("/api/series")
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.series)) {
          setSeries(json.series as Series[]);
        }
      })
      .catch(() => setSeries([]));
  }, []);

  const filtered = useMemo(() => {
    if (!q) return series;
    return series.filter((s) => {
      const localized = getSeriesI18nText(s, lang);
      const text = [localized.title, localized.description ?? "", localized.tagline ?? ""]
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [q, series, lang]);

  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex-1 px-4 pb-24 pt-3">
        {!q ? (
          <div className="flex flex-wrap gap-2">
            {CATEGORY_TAGS.map((tag: CategoryTag) => (
              <Badge key={tag} variant="outline">
                {t(`tags.${getTagKey(tag)}`)}
              </Badge>
            ))}
          </div>
        ) : (
          <div className="mb-3">
            <h1 className="text-base font-semibold text-zinc-100">
              {t("nav.search")}
            </h1>
            <p className="mt-1 text-xs text-zinc-400">
              {t("home.resultsFound", {
                count: filtered.length,
                query: qRaw
              })}
            </p>
          </div>
        )}

        <div className="mt-5 space-y-3">
          {filtered.map((s) => {
            const localized = getSeriesI18nText(s, lang);
            return (
              <Link
                key={s.id}
                href={`/series/${s.id}`}
                className="flex items-center justify-between rounded-2xl border border-zinc-800/80 bg-zinc-950/60 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-100">
                    {localized.title}
                  </p>
                  <p className="mt-0.5 line-clamp-1 text-xs text-zinc-400">
                    {localized.tagline}
                  </p>
                </div>
                <span className="text-xs font-medium text-brand">
                  {t("open")}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}

export default function ExplorePage() {
  const { t } = useTranslation();
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col">
          <div className="flex-1 px-4 pb-24 pt-3">
            <div className="text-xs text-zinc-500">{t("loading")}</div>
          </div>
        </main>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}
