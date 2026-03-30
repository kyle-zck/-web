"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { tagLabel } from "@/lib/i18n/tagKey";

export function SeriesDetailHeader({ tags }: { tags: string[] }) {
  const { t } = useTranslation();

  return (
    <>
      <div className="px-4 pt-3">
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="pill" className="bg-black/60">
              {tagLabel(tag, t)}
            </Badge>
          ))}
        </div>
      </div>
    </>
  );
}

