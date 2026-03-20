import { notFound } from "next/navigation";
import { ImmersiveSeriesDetail } from "@/components/player/immersive-series-detail";
import { getSeriesById } from "@/lib/series-repo";

export const dynamic = "force-dynamic";

export default async function SeriesDetailPage({
  params
}: {
  params: { id: string };
}) {
  const series = await getSeriesById(params.id);
  if (!series) return notFound();

  return (
    <main className="h-full min-h-0 overflow-hidden lg:flex lg:flex-col">
      <ImmersiveSeriesDetail series={series} />
    </main>
  );
}
