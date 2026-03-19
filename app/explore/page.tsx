"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Series, CategoryTag } from "@/constants/mock-data";
import { useTranslation } from "react-i18next";
import type { AppLanguage } from "@/lib/i18n/languages";
import { getSeriesI18nText } from "@/lib/i18n/seriesText";
import { getTagKey } from "@/lib/i18n/tagKey";

function ExploreContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;

  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(6);
  const [showAllSubTags, setShowAllSubTags] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const qRaw = searchParams.get("q") ?? "";
  const q = qRaw.trim().toLowerCase();
  const tagFromUrl = (searchParams.get("tag") as CategoryTag | null) ?? null;
  const dimFromUrl = searchParams.get("dim") ?? "actors";
  const subTagFromUrl = searchParams.get("sub") ?? "";

  const activeTag: CategoryTag | "all" = tagFromUrl ?? "all";
  const activeSubTag = subTagFromUrl || "";
  const activeTopTab =
    dimFromUrl === "actresses" ||
    dimFromUrl === "identities" ||
    dimFromUrl === "storyBeats"
      ? dimFromUrl
      : "actors";

  const SUB_TAGS: Record<CategoryTag, string[]> = {
    Romance: ["CEO's Lover", "Runaway Bride", "Secret Crush", "Forbidden Love"],
    Revenge: ["Cold-Blooded", "Back from Hell", "Silent Plan", "Vengeful Bride"],
    Werewolf: ["Alpha", "Luna", "Pack Leader", "Rogue Wolf"],
    CEO: ["Billionaire", "Assistant", "Fake Marriage", "Office Romance"],
    Fantasy: ["Witch", "Vampire", "Demon Hunter", "Dragon Rider"],
    "Time Travel": ["Back to School", "Ancient Palace", "Parallel World", "Restart Life"]
  };

  useEffect(() => {
    fetch("/api/series")
      .then((r) => r.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.series)) {
          setSeries(json.series as Series[]);
        }
      })
      .catch(() => setSeries([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let base = series;

    if (activeTag !== "all") {
      base = base.filter((s) => s.tags.includes(activeTag));
    }

    if (activeSubTag) {
      const lowerSub = activeSubTag.toLowerCase();
      base = base.filter((s) => {
        const localized = getSeriesI18nText(s, lang);
        const text = [localized.title, localized.description ?? "", localized.tagline ?? ""]
          .join(" ")
          .toLowerCase();
        return text.includes(lowerSub);
      });
    }

    if (!q) return base;

    return base.filter((s) => {
      const localized = getSeriesI18nText(s, lang);
      const text = [localized.title, localized.description ?? "", localized.tagline ?? ""]
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [q, series, lang, activeTag, activeSubTag]);

  useEffect(() => {
    setVisibleCount(6);
  }, [q, activeTag, activeSubTag]);

  useEffect(() => {
    if (!loadMoreRef.current) return;
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        setVisibleCount((prev) => {
          if (prev >= filtered.length) return prev;
          return prev + 6;
        });
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [filtered.length]);

  const handleTabClick = (tag: CategoryTag | "all") => {
    const params = new URLSearchParams(searchParams.toString());
    if (tag === "all") {
      params.delete("tag");
      params.delete("sub");
    } else {
      params.set("tag", tag);
      params.delete("sub");
    }
    router.push(`/explore?${params.toString()}`);
  };

  const handleSubTagClick = (sub: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (sub === activeSubTag) {
      params.delete("sub");
    } else {
      params.set("sub", sub);
    }
    router.push(`/explore?${params.toString()}`);
  };

  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex-1 bg-black px-4 pb-24 pt-3">
        {/* 一级 Tab：Actors / Actresses / Identities / Story Beats */}
        <div className="mb-2 flex gap-6 border-b border-zinc-800 pb-2 text-xs font-semibold text-zinc-400 lg:text-sm">
          {[
            { id: "actors", label: t("explore.tabs.actors") },
            { id: "actresses", label: t("explore.tabs.actresses") },
            { id: "identities", label: t("explore.tabs.identities") },
            { id: "storyBeats", label: t("explore.tabs.storyBeats") }
          ].map((tab) => {
            const isActive = activeTopTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("dim", tab.id);
                  router.push(`/explore?${params.toString()}`);
                }}
                className={`border-b-2 pb-1 transition-colors ${
                  isActive
                    ? "border-red-600 text-white"
                    : "border-transparent hover:text-red-500"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 顶部 Tag Tab：全部 + 主分类 */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <button
            type="button"
            onClick={() => handleTabClick("all")}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              activeTag === "all"
                ? "bg-red-600 text-white"
                : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {t("explore.all")}
          </button>
          {(["Romance", "Revenge", "Werewolf", "CEO", "Fantasy", "Time Travel"] as CategoryTag[]).map(
            (tag: CategoryTag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleTabClick(tag)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  activeTag === tag
                    ? "bg-red-600 text-white"
                    : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                {t(`tags.${getTagKey(tag)}`)}
              </button>
            )
          )}
        </div>

        {/* 标签云：仅在有选定分类且无搜索时展示 */}
        {activeTag !== "all" && !q ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(SUB_TAGS[activeTag] ?? [])
                .slice(0, showAllSubTags ? undefined : 6)
                .map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => handleSubTagClick(sub)}
                    className={`rounded-md bg-[#222222] px-3 py-1 text-xs font-semibold text-white ${
                      activeSubTag === sub
                        ? "ring-1 ring-red-500"
                        : "hover:bg-zinc-800"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
            </div>
            {SUB_TAGS[activeTag] && SUB_TAGS[activeTag].length > 6 ? (
              <button
                type="button"
                onClick={() => setShowAllSubTags((v) => !v)}
                className="flex items-center gap-1 rounded-md bg-[#222222] px-2 py-1 text-xs font-semibold text-zinc-200 hover:text-red-500"
              >
                {showAllSubTags ? t("explore.collapse") : t("explore.expand")}
                <span className="text-[10px]">
                  {showAllSubTags ? "▲" : "▼"}
                </span>
              </button>
            ) : null}
          </div>
        ) : null}

        {/* 搜索结果标题 */}
        {q ? (
          <div className="mb-3 mt-4">
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
        ) : null}

        {/* 区块标题 */}
        <h2 className="mt-5 text-sm font-semibold text-zinc-100 lg:text-base">
          {t("explore.moviesOfAllActors")}
        </h2>

        {/* 内容卡片网格 */}
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  className="flex gap-3 rounded-2xl bg-zinc-950/80 p-3 shadow-[0_0_18px_rgba(0,0,0,0.7)]"
                >
                  <div className="aspect-[2/3] w-28 animate-pulse rounded-xl bg-zinc-800" />
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-zinc-800" />
                    <div className="h-3 w-full animate-pulse rounded bg-zinc-900" />
                    <div className="h-3 w-5/6 animate-pulse rounded bg-zinc-900" />
                    <div className="mt-auto h-7 w-20 animate-pulse rounded-full bg-zinc-800" />
                  </div>
                </div>
              ))
            : filtered.slice(0, visibleCount).map((s) => {
                const localized = getSeriesI18nText(s, lang);
                return (
                  <Link
                    key={s.id}
                    href={`/series/${s.id}`}
                    className="group flex gap-3 rounded-2xl bg-zinc-950/80 p-3 shadow-[0_0_18px_rgba(0,0,0,0.7)] transition-colors duration-200 hover:bg-zinc-900"
                  >
                    <div className="relative aspect-[2/3] w-28 overflow-hidden rounded-xl bg-zinc-900 transition-transform duration-200 group-hover:scale-[1.03]">
                      <img
                        src={s.poster || s.cover}
                        alt={localized.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex flex-1 flex-col">
                      <h2 className="text-base font-bold text-white lg:text-lg">
                        {localized.title}
                      </h2>
                      <p className="mt-1 line-clamp-3 text-xs text-zinc-400 lg:text-sm">
                        {localized.description ?? localized.tagline}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-500">
                        <span className="flex items-center gap-1">
                          <span>▶</span>
                          <span>13.1M</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span>★</span>
                          <span>154.3k</span>
                        </span>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-zinc-200"
                        >
                          {t("series.play")}
                        </button>
                      </div>
                    </div>
                  </Link>
                );
              })}
        </div>
        <div ref={loadMoreRef} className="h-8 w-full" />
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
