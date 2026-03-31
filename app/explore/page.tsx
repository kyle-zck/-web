"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Series } from "@/constants/mock-data";
import { CATEGORY_TAGS } from "@/constants/mock-data";
import { useTranslation } from "react-i18next";
import type { AppLanguage } from "@/lib/i18n/languages";
import { getSeriesI18nText } from "@/lib/i18n/seriesText";
import { tagLabel } from "@/lib/i18n/tagKey";
import { getSeriesArtworkChain } from "@/lib/series/artwork";
import { PosterImage } from "@/components/ui/poster-image";
import {
  SeriesEngagementInline,
  type EngagementCounts
} from "@/components/ui/series-engagement-inline";

function ExploreContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as AppLanguage;

  const [series, setSeries] = useState<Series[]>([]);
  const [catalogNames, setCatalogNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(6);
  const [countsById, setCountsById] = useState<Record<string, EngagementCounts>>({});
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const qRaw = searchParams.get("q") ?? "";
  const q = qRaw.trim().toLowerCase();
  const tagParam = searchParams.get("tag");
  const activeTag: string | "all" = tagParam ? tagParam : "all";

  const tabTags = useMemo(
    () => (catalogNames.length > 0 ? catalogNames : [...CATEGORY_TAGS]),
    [catalogNames]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch("/api/series?lite=1", { cache: "default" }).then((r) => r.json()),
      fetch("/api/tag-catalog", { cache: "default" }).then((r) => r.json())
    ])
      .then(([seriesJson, tagJson]) => {
        if (cancelled) return;
        if (seriesJson?.ok && Array.isArray(seriesJson.series)) {
          setSeries(seriesJson.series as Series[]);
        } else {
          setSeries([]);
        }
        if (tagJson?.ok && Array.isArray(tagJson.items)) {
          setCatalogNames(tagJson.items.map((x: { name: string }) => x.name).filter(Boolean));
        } else {
          setCatalogNames([]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSeries([]);
          setCatalogNames([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    let base = series;

    if (activeTag !== "all") {
      base = base.filter((s) => (s.tags ?? []).includes(activeTag));
    }

    if (!q) return base;

    return base.filter((s) => {
      const localized = getSeriesI18nText(s, lang);
      const text = [localized.title, localized.description ?? "", localized.tagline ?? ""]
        .join(" ")
        .toLowerCase();
      return text.includes(q);
    });
  }, [q, series, lang, activeTag]);

  /** 与播放页同源：批量拉取收藏/点赞/观看数 */
  useEffect(() => {
    if (filtered.length === 0) {
      setCountsById({});
      return;
    }
    let cancelled = false;
    const ids = filtered.map((s) => s.id);
    fetch("/api/series/counts-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    })
      .then((r) => r.json())
      .then(
        (json: {
          ok?: boolean;
          byId?: Record<
            string,
            { collectionCount?: number; likesCount?: number; viewsCount?: number }
          >;
        }) => {
          if (cancelled || !json?.ok || !json.byId) return;
          const next: Record<string, EngagementCounts> = {};
          for (const [id, v] of Object.entries(json.byId)) {
            next[id] = {
              viewsCount: v.viewsCount ?? 0,
              collectionCount: v.collectionCount ?? 0,
              likesCount: v.likesCount ?? 0
            };
          }
          setCountsById(next);
        }
      )
      .catch(() => {
        if (!cancelled) setCountsById({});
      });
    return () => {
      cancelled = true;
    };
  }, [filtered]);

  useEffect(() => {
    setVisibleCount(6);
  }, [q, activeTag]);

  useEffect(() => {
    if (loading) return;
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
  }, [filtered.length, loading]);

  const handleTabClick = (tag: string | "all") => {
    const params = new URLSearchParams(searchParams.toString());
    if (tag === "all") {
      params.delete("tag");
    } else {
      params.set("tag", tag);
    }
    router.push(`/explore?${params.toString()}`);
  };

  return (
    <main className="flex min-h-screen flex-col text-sm lg:text-base">
      <div className="page-gutter-x flex-1 bg-black pb-28 pt-4">
        {/* 顶部 Tag Tab：全部 + 管理标签目录（或内置种子） */}
        <div className="mb-3 flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <button
            type="button"
            onClick={() => handleTabClick("all")}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
              activeTag === "all"
                ? "bg-red-600 text-white"
                : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {t("explore.all")}
          </button>
          {tabTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleTabClick(tag)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                activeTag === tag
                  ? "bg-red-600 text-white"
                  : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {tagLabel(tag, t)}
            </button>
          ))}
        </div>

        {/* 搜索结果标题 */}
        {q ? (
          <div className="mb-4 mt-5">
            <h1 className="section-title-fluid font-semibold text-zinc-100">{t("nav.search")}</h1>
            <p className="text-body-fluid mt-2 text-zinc-400">
              {t("home.resultsFound", {
                count: filtered.length,
                query: qRaw
              })}
            </p>
          </div>
        ) : null}

        {/* 区块标题 */}
        <h2 className="section-title-fluid mt-6 font-semibold text-zinc-100">
          {t("explore.moviesOfAllActors")}
        </h2>

        {/* 内容卡片网格 */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 md:gap-6">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  // eslint-disable-next-line react/no-array-index-key
                  key={i}
                  className="flex gap-4 rounded-2xl bg-zinc-950/80 p-4 shadow-[0_0_18px_rgba(0,0,0,0.7)]"
                >
                  <div className="aspect-[2/3] w-44 animate-pulse rounded-2xl bg-zinc-800" />
                  <div className="flex flex-1 flex-col gap-3">
                    <div className="h-5 w-2/3 animate-pulse rounded bg-zinc-800" />
                    <div className="h-4 w-full animate-pulse rounded bg-zinc-900" />
                    <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-900" />
                    <div className="mt-auto h-9 w-28 animate-pulse rounded-full bg-zinc-800" />
                  </div>
                </div>
              ))
            : filtered.slice(0, visibleCount).map((s, cardIdx) => {
                const localized = getSeriesI18nText(s, lang);
                const artworkChain = getSeriesArtworkChain(s);
                return (
                  <Link
                    key={s.id}
                    href={`/series/${s.id}`}
                    prefetch={false}
                    onMouseEnter={() => router.prefetch(`/series/${s.id}`)}
                    aria-label={`${localized.title} — ${t("series.play")}`}
                    className="group flex gap-4 rounded-2xl bg-zinc-950/80 p-4 shadow-[0_0_18px_rgba(0,0,0,0.7)] transition-colors duration-200 hover:bg-zinc-900"
                  >
                    <div className="poster-card-drama relative aspect-[2/3] w-44 shrink-0 overflow-hidden transition-transform duration-200 group-hover:scale-[1.03]">
                      <PosterImage
                        chain={artworkChain}
                        alt={localized.title}
                        sizes="(max-width:640px) min(46vw, 176px), 176px"
                        className="poster-card-drama__img"
                        priority={cardIdx === 0}
                      />
                      <div
                        className="poster-card-drama__overlay poster-card-drama__overlay--hero absolute inset-0 z-[1]"
                        aria-hidden
                      />
                    </div>
                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <h2 className="text-[clamp(1rem,0.92rem+0.35vw,1.35rem)] font-bold leading-snug text-white md:text-[clamp(1.05rem,0.95rem+0.4vw,1.5rem)]">
                          {localized.title}
                        </h2>
                        <p className="text-body-fluid mt-3 line-clamp-3 text-zinc-400">
                          {localized.description ?? localized.tagline}
                        </p>
                      </div>
                      <div className="mt-6 flex items-center justify-between gap-3">
                        <SeriesEngagementInline
                          dense
                          counts={
                            countsById[s.id] ?? {
                              viewsCount: 0,
                              collectionCount: 0,
                              likesCount: 0
                            }
                          }
                        />
                        {/* <a> 内不可嵌套 <button>，否则浏览器可能拦截点击导致无法跳转 */}
                        <span className="inline-flex rounded-full bg-white px-6 py-2 text-sm font-extrabold text-black transition-colors duration-150 group-hover:bg-red-600 group-hover:text-white lg:px-7 lg:py-2.5 lg:text-base">
                          {t("series.play")}
                        </span>
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
          <div className="page-gutter-x flex-1 pb-24 pt-3">
            <div className="text-xs text-zinc-500">{t("loading")}</div>
          </div>
        </main>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}
