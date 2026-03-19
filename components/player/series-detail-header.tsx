"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import type { CategoryTag } from "@/constants/mock-data";
import { Badge } from "@/components/ui/badge";
import { getTagKey } from "@/lib/i18n/tagKey";

export function SeriesDetailHeader({
  tags
}: {
  tags: CategoryTag[];
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className="px-4 pt-4">
        <Link
          href="/"
          className="text-xs font-medium text-zinc-400 hover:text-zinc-200"
        >
          ← {t("backHome")}
        </Link>
      </div>
      <div className="px-4 pt-3">
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="pill" className="bg-black/60">
              {t(`tags.${getTagKey(tag)}`)}
            </Badge>
          ))}
        </div>
      </div>
    </>
  );
}

