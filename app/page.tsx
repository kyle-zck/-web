import { HeroCarousel } from "@/components/player/hero-carousel";
import { getAllSeries } from "@/lib/series-repo";
import type { Series } from "@/constants/mock-data";
import { SERIES_LIST } from "@/constants/mock-data";
import dynamic from "next/dynamic";
import { getCachedAppConfig } from "@/lib/app-config/service";

const ContinueWatching = dynamic(
  () =>
    import("@/components/home/continue-watching").then((m) => m.ContinueWatching),
  { loading: () => null, ssr: false }
);

/** 首屏下方类目行按需加载，减轻主线程解析与未使用 JS（Lighthouse） */
const SeriesRow = dynamic(
  () => import("@/components/ui/series-row").then((m) => m.SeriesRow),
  {
    loading: () => (
      <div
        className="mb-6 h-36 animate-pulse rounded-2xl bg-zinc-900/30 lg:mb-10"
        aria-hidden
      />
    )
  }
);

const MoreMoviesLink = dynamic(() =>
  import("@/components/home/more-movies-link").then((m) => m.MoreMoviesLink)
);
import { slimSeriesListForPublic } from "@/lib/series/slim-public";
import { getEngagementCountsBatch } from "@/lib/user-repo";

/** 生产环境首页可缓存，减轻 DB/磁盘压力；开发模式仍按需渲染 */
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

  return {
    heroItems,
    heroCountsBySeriesId,
    newReleaseItems,
    trending,
    hiddenIdentity,
    loveAtFirstSight,
    magicAndMates,
    secondChance,
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
            <SeriesRow
              titleKey="home.newRelease"
              items={c.newReleaseItems}
              eagerFirst={c.newReleaseItems.length > 0}
            />
          ) : null}
          {c.showTrendingRow ? (
            <SeriesRow
              titleKey="home.trendingDramas"
              items={c.trending}
              eagerFirst={
                (!c.showNewRow || c.newReleaseItems.length === 0) && c.trending.length > 0
              }
            />
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
