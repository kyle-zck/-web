import { HeroCarousel } from "@/components/player/hero-carousel";
import { CategoryTags } from "@/components/ui/category-tags";
import { SeriesRow } from "@/components/ui/series-row";
import { getAllSeries } from "@/lib/series-repo";
import type { CategoryTag } from "@/constants/mock-data";
import { ContinueWatching } from "@/components/home/continue-watching";
import { MoreMoviesLink } from "@/components/home/more-movies-link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const series = await getAllSeries();
  const trending = series.filter((s) => s.isTrending);
  const newArrivals = series.filter((s) => s.isNew);

  const byTag = (tag: CategoryTag) =>
    series.filter((s) => s.tags.includes(tag)).slice(0, 12);

  const hiddenIdentity = byTag("Revenge");
  const loveAtFirstSight = byTag("Romance");
  const magicAndMates = byTag("Fantasy");
  const secondChance = byTag("Time Travel");

  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex-1 px-4 pb-20 pt-4 space-y-6 lg:px-10 lg:pb-24 lg:pt-6 lg:space-y-8">
        {/* Hero 区域：横屏时作为顶部主视觉 */}
        <HeroCarousel items={trending.length ? trending : series} />

        {/* 继续观看：在横屏下紧跟 Hero 一行展示 */}
        <ContinueWatching />

        {/* 分类与多条横向卡片区域 */}
        <CategoryTags titleKey="home.categories" viewAllHref="/explore" />

        <SeriesRow
          titleKey="home.newRelease"
          items={newArrivals.length ? newArrivals : trending}
        />
        <SeriesRow titleKey="home.trendingDramas" items={trending} />

        <SeriesRow titleKey="home.hiddenIdentity" items={hiddenIdentity} />
        <SeriesRow
          titleKey="home.loveAtFirstSight"
          items={loveAtFirstSight}
        />
        <SeriesRow titleKey="home.magicAndMates" items={magicAndMates} />
        <SeriesRow titleKey="home.secondChance" items={secondChance} />

        <div className="pt-2">
          <MoreMoviesLink />
        </div>
      </div>
    </main>
  );
}
