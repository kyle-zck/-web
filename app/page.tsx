import { HeroCarousel } from "@/components/player/hero-carousel";
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
  const allForFill = [...newArrivals, ...trending, ...series];

  // 保证 New Release 至少显示 5 个卡片
  const newReleaseItems =
    newArrivals.length >= 5
      ? newArrivals.slice(0, 5)
      : allForFill
          .filter(
            (s, idx, arr) => arr.findIndex((x) => x.id === s.id) === idx
          )
          .slice(0, 5);

  const byTag = (tag: CategoryTag) =>
    series.filter((s) => s.tags.includes(tag)).slice(0, 12);

  const hiddenIdentity = byTag("Revenge");
  const loveAtFirstSight = byTag("Romance");
  const magicAndMates = byTag("Fantasy");
  const secondChance = byTag("Time Travel");

  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex-1 px-4 pb-24 pt-10 space-y-8 lg:px-10 lg:pb-28 lg:pt-16 lg:space-y-10">
        {/* Hero：使用 New Release 列表做主轮播 */}
        <HeroCarousel items={newReleaseItems} />

        {/* 继续观看：在横屏下紧跟 Hero 一行展示 */}
        <ContinueWatching />

        <SeriesRow titleKey="home.newRelease" items={newReleaseItems} />
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
