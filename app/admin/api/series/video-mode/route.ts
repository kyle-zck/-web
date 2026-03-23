import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { getAllSeries } from "@/lib/series-repo";
import { getViewsCount } from "@/lib/user-repo";
import { getEpisodeVideoMode, getSeriesVideoMode } from "@/lib/video/series-video-mode";

export async function GET(req: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const url = new URL(req.url);
  const minViews = Number(url.searchParams.get("minViews") ?? "0");
  const onlyNeedTranscode = url.searchParams.get("onlyNeedTranscode") !== "0";

  const series = await getAllSeries();
  const rows = await Promise.all(
    series.map(async (s) => {
      const viewsCount = await getViewsCount(s.id);
      const episodes = s.episodes ?? [];
      const hlsEpisodes = episodes.filter((ep) => getEpisodeVideoMode(ep) === "hls").length;
      const processingEpisodes = episodes.filter(
        (ep) => getEpisodeVideoMode(ep) === "processing"
      ).length;
      const mode = getSeriesVideoMode(s);
      return {
        id: s.id,
        dramaId: s.dramaId ?? null,
        title: s.title,
        viewsCount,
        mode,
        totalEpisodes: episodes.length,
        hlsEpisodes,
        processingEpisodes
      };
    })
  );

  const filtered = rows
    .filter((row) => row.viewsCount >= (Number.isFinite(minViews) ? minViews : 0))
    .filter((row) => (onlyNeedTranscode ? row.mode !== "hls" : true))
    .sort((a, b) => b.viewsCount - a.viewsCount);

  return NextResponse.json({
    ok: true,
    total: filtered.length,
    rows: filtered
  });
}
