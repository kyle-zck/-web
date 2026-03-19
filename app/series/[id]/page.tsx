import { notFound } from "next/navigation";
import { ImmersiveSeriesDetail } from "@/components/player/immersive-series-detail";
import { getSeriesById } from "@/lib/series-repo";
import { SeriesDetailHeader } from "@/components/player/series-detail-header";

export const dynamic = "force-dynamic";

export default async function SeriesDetailPage({
  params
}: {
  params: { id: string };
}) {
  const series = await getSeriesById(params.id);
  if (!series) return notFound();

  return (
    <main className="min-h-screen pb-10">
      <SeriesDetailHeader tags={series.tags} />
      <ImmersiveSeriesDetail series={series} />
    </main>
  );
}
