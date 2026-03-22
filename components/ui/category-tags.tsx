"use client";

import { useEffect, useState } from "react";
import { CATEGORY_TAGS } from "@/constants/mock-data";
import type { AppLanguage } from "@/lib/i18n/languages";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { tagLabel } from "@/lib/i18n/tagKey";

export function CategoryTags({
  titleKey,
  viewAllHref = "/explore"
}: {
  titleKey?: string;
  viewAllHref?: string;
}) {
  const { t, i18n } = useTranslation();
  const _lang = i18n.language as AppLanguage;
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/tag-catalog")
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.items)) {
          setNames(json.items.map((x: { name: string }) => x.name).filter(Boolean));
        }
      })
      .catch(() => setNames([]));
  }, []);

  const tabTags = names.length > 0 ? names : CATEGORY_TAGS;

  return (
    <section className="mb-4">
      {titleKey ? (
        <div className="mb-2 flex items-end justify-between px-1">
          <h2 className="text-sm font-semibold text-zinc-100">{t(titleKey)}</h2>
          <a href={viewAllHref} className="text-xs font-medium text-zinc-400 hover:text-zinc-200">
            {t("home.viewAll")}
          </a>
        </div>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {tabTags.map((tag) => (
          <a key={tag} href={`/explore?tag=${encodeURIComponent(tag)}`} className="shrink-0">
            <Badge variant="outline">{tagLabel(tag, t)}</Badge>
          </a>
        ))}
      </div>
    </section>
  );
}
