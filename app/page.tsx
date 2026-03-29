import { HeroCarousel } from "@/components/player/hero-carousel";
import { getAllSeries } from "@/lib/series-repo";
import type { Series } from "@/constants/mock-data";
import { SERIES_LIST } from "@/constants/mock-data";
import dynamic from "next/dynamic";
import { getCachedAppConfig } from "@/lib/app-config/service";
import { MoreMoviesLink } from "@/components/home/more-movies-link";
import { SeriesRow } from "@/components/ui/series-row";

const ContinueWatching = dynamic(
  () =>
    import("@/components/home/continue-watching").then((m) => m.ContinueWatching),
  { loading: () => null, ssr: false }
);
import { slimSeriesListForPublic } from "@/lib/series/slim-public";
import { getEngagementCountsBatch } from "@/lib/user-repo";

export const revalidate = 60;

function seriesCreatedSortTime(s: Series): number {
  return s.listedAt ?? s.completedAt ?? s.createdAt ?? 0;
}

async function buildHomeContent() {
  const [appConfig, rawSeries] = await Promise.all([
    getCachedAppConfig(),
    getAllSeries().catch((e) => {
      console.error("[home] getAllSeries 失败，使用内置种子列表", e);
      return SERIES_LIST;
    })
  ]);
  const homeCfg = appConfig.home;

  const all = slimSeriesListForPublic(rawSeries);
  const series = all.filter((s) => s.listed !== false);
  const byId = new Map(series.map((s) => [s.id, s]));

  const heroIds = (homeCfg?.featuredSeriesIds ?? []).map((id) => id.trim()).filter(Boolean);
  const heroPicked = heroIds
    .map((id) => byId.get(id))
    .filter((x): x is Series => Boolean(x));

  const fallbackNew = [...series].sort((a, b) => seriesCreatedSortTime(b) - seriesCreatedSortTime(a));
  const heroFallback = fallbackNew.slice(0, 5);
  const heroItems = (heroPicked.length > 0 ? heroPicked : heroFallback).slice(0, 5);

  const heroCountsBySeriesId = await getEngagementCountsBatch(heroItems.map((s) => s.id));

  const newReleaseItems = fallbackNew.slice(0, 7);

  const configuredRows = (homeCfg?.titleRows ?? [])
    .map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind ?? "custom",
      hidden: r.hidden === true,
      seriesIds: r.seriesIds ?? []
    }))
    .filter((r) => r.title.trim().length > 0);

  return {
    heroItems,
    heroCountsBySeriesId,
    newReleaseItems,
    configuredRows,
    byId
  };
}

export default async function HomePage() {
  try {
    const c = await buildHomeContent();
    return (
      <main className="flex min-h-screen flex-col">
        <div className="page-gutter-x flex-1 space-y-6 pb-20 pt-8 md:space-y-8 md:pb-24 md:pt-12">
          <HeroCarousel items={c.heroItems} countsBySeriesId={c.heroCountsBySeriesId} />

          {c.configuredRows.map((row) => {
            if (row.hidden) return null;
            if (row.kind === "continue") {
              return <ContinueWatching key={row.id} />;
            }

            if (row.kind === "newRelease") {
              return <SeriesRow key={row.id} titleText={row.title} items={c.newReleaseItems} />;
            }

            const items = row.seriesIds
              .map((id) => c.byId.get(id))
              .filter((x): x is Series => Boolean(x));

            return <SeriesRow key={row.id} titleText={row.title} items={items} />;
          })}

          <div className="pt-1 md:pt-2">
            <MoreMoviesLink />
          </div>
        </div>
      </main>
    );
  } catch (e) {
    console.error("[home] 渲染失败", e);
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-6 py-20">
        <p className="text-center text-lg font-semibold text-white">首页暂时无法加载</p>
        <p className="mt-2 max-w-md text-center text-sm text-zinc-400">
          请稍后刷新页面。若持续出现，请检查终端日志与数据库配置。
        </p>
      </main>
    );
  }
}
