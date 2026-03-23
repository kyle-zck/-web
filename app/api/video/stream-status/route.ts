import { NextResponse } from "next/server";
import { getStreamPlaybackStatus } from "@/lib/video/cloudflare-stream";
import { getSeriesById, updateEpisodeStreamState } from "@/lib/series-repo/service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    seriesId?: string;
    episodeId?: string;
    streamId?: string;
  };
  const seriesId = (body.seriesId ?? "").trim();
  const episodeId = (body.episodeId ?? "").trim();
  const streamId = (body.streamId ?? "").trim();
  if (!seriesId || !episodeId || !streamId) {
    return NextResponse.json(
      { ok: false, error: "seriesId, episodeId, streamId are required" },
      { status: 400 }
    );
  }

  const state = await getStreamPlaybackStatus(streamId);
  if (!state) {
    return NextResponse.json({ ok: false, error: "stream status unavailable" }, { status: 502 });
  }

  // 防止任意 episodeId 被外部请求串改：仅允许更新与当前 streamId 匹配的分集
  const series = await getSeriesById(seriesId);
  const target = (series?.episodes ?? []).find((e) => e.id === episodeId);
  if (!target) {
    return NextResponse.json({ ok: false, error: "episode not found" }, { status: 404 });
  }
  if (target.videoStreamId && target.videoStreamId !== streamId) {
    return NextResponse.json({ ok: false, error: "stream mismatch" }, { status: 403 });
  }

  if (state.status === "ready" || state.status === "failed") {
    await updateEpisodeStreamState(seriesId, episodeId, {
      videoStreamId: streamId,
      videoPlaybackUrl: state.playbackUrl,
      videoStatus: state.status
    });
  }

  return NextResponse.json({
    ok: true,
    streamId,
    videoPlaybackUrl: state.playbackUrl,
    videoStatus: state.status
  });
}
