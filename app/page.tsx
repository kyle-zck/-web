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
  const trending = series.filter((s) => s.isTrending);
  const newArrivals = series.filter((s) => s.isNew);
  const allForFill = [...newArrivals, ...trending, ...series];

  const dedupFill: Series[] = [];
  const seenFill = new Set<string>();
  for (const s of allForFill) {
    if (seenFill.has(s.id)) continue;
    seenFill.add(s.id);
    dedupFill.push(s);
  }
  const newReleaseItems =
    newArrivals.length >= 5 ? newArrivals.slice(0, 5) : dedupFill.slice(0, 5);

  const featuredIds = (homeCfg?.featuredSeriesIds ?? []).map((id) => id.trim()).filter(Boolean);
  const byId = new Map(series.map((s) => [s.id, s]));

  let heroItems: Series[];
  if (featuredIds.length > 0) {
    const picked = featuredIds
      .map((id) => byId.get(id))
      .filter((x): x is Series => Boolean(x));
    if (picked.length > 0) {
      const used = new Set(picked.map((s) => s.id));
      const filler = allForFill.filter((s) => !used.has(s.id));
      heroItems = [...picked, ...filler].slice(0, 5);
    } else {
      heroItems = newReleaseItems;
    }
  } else {
    heroItems = newReleaseItems;
  }

  const heroIds = heroItems.map((s) => s.id);
  const heroCountsBySeriesId = await getEngagementCountsBatch(heroIds);

  const byTag = (tag: string) => series.filter((s) => s.tags.includes(tag)).slice(0, 12);

  const hiddenIdentity = byTag("Revenge");
  const loveAtFirstSight = byTag("Romance");
  const magicAndMates = byTag("Fantasy");
  const secondChance = byTag("Time Travel");

  const showContinue = homeCfg?.showContinueWatching !== false;
  const showNewRow = homeCfg?.showNewRelease !== false;
  const showTrendingRow = homeCfg?.showTrending !== false;
  const showCategories = homeCfg?.showCategoryRows !== false;

  const customRows = (homeCfg?.titleRows ?? [])
    .map((row) => {
      const items = row.seriesIds
        .map((id) => byId.get(id))
        .filter((x): x is Series => Boolean(x));
      return {
        id: row.id,
        title: row.title,
        items
      };
    })
    .filter((row) => row.title.trim().length > 0 && row.items.length > 0);

  return {
    heroItems,
    heroCountsBySeriesId,
    newReleaseItems,
    trending,
    hiddenIdentity,
    loveAtFirstSight,
    magicAndMates,
    secondChance,
    customRows,
    showContinue,
    showNewRow,
    showTrendingRow,
    showCategories
  };
}

export default async function HomePage() {
  try {
    const c = await buildHomeContent();
    return (
      <main className="flex min-h-screen flex-col">
        <div className="page-gutter-x flex-1 space-y-8 pb-24 pt-10 lg:space-y-10 lg:pb-28 lg:pt-16">
          <HeroCarousel items={c.heroItems} countsBySeriesId={c.heroCountsBySeriesId} />

          {c.showContinue ? <ContinueWatching /> : null}

          {c.showNewRow ? (
            <SeriesRow titleKey="home.newRelease" items={c.newReleaseItems} />
          ) : null}
          {c.showTrendingRow ? (
            <SeriesRow titleKey="home.trendingDramas" items={c.trending} />
          ) : null}

          {c.showCategories ? (
            <>
              <SeriesRow titleKey="home.hiddenIdentity" items={c.hiddenIdentity} />
              <SeriesRow
                titleKey="home.loveAtFirstSight"
                items={c.loveAtFirstSight}
              />
              <SeriesRow titleKey="home.magicAndMates" items={c.magicAndMates} />
              <SeriesRow titleKey="home.secondChance" items={c.secondChance} />
            </>
          ) : null}

          {c.customRows.map((row) => (
            <SeriesRow key={row.id} titleText={row.title} items={row.items} />
          ))}

          <div className="pt-2">
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
