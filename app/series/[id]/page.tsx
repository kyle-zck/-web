import { notFound } from "next/navigation";
import { getSeriesById } from "@/lib/series-repo";
import { SeriesDetailClient } from "./series-detail-client";

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
      <SeriesDetailClient series={series} />
    </main>
  );
}
