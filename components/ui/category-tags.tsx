"use client";

import { CATEGORY_TAGS } from "@/constants/mock-data";
import type { AppLanguage } from "@/lib/i18n/languages";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { getTagKey } from "@/lib/i18n/tagKey";

export function CategoryTags({
  titleKey,
  viewAllHref = "/explore"
}: {
  titleKey?: string;
  viewAllHref?: string;
}) {
  const { t, i18n } = useTranslation();
  const _lang = i18n.language as AppLanguage;

  return (
    <section className="mb-4">
      {titleKey ? (
        <div className="mb-2 flex items-end justify-between px-1">
          <h2 className="text-sm font-semibold text-zinc-100">
            {t(titleKey)}
          </h2>
          <a
            href={viewAllHref}
            className="text-xs font-medium text-zinc-400 hover:text-zinc-200"
          >
            {t("home.viewAll")}
          </a>
        </div>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {CATEGORY_TAGS.map((tag) => (
          <button key={tag} type="button" className="shrink-0">
            <Badge variant="outline">{t(`tags.${getTagKey(tag)}`)}</Badge>
          </button>
        ))}
      </div>
    </section>
  );
}
