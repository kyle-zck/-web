import { NextResponse } from "next/server";
import { invalidateSeriesCatalogCaches } from "@/lib/cache/invalidate-data-cache";
import { requireAdminSession } from "@/lib/admin/auth";
import { deleteEpisodeFromSeries, updateEpisodeStreamState } from "@/lib/series-repo/service";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; epId: string } }
) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const body = (await req.json()) as {
    videoUrl?: string;
    videoStreamId?: string;
    videoPlaybackUrl?: string;
    videoStatus?: "processing" | "ready" | "failed";
    title?: string;
  };

  const series = await updateEpisodeStreamState(params.id, params.epId, {
    videoUrl: body.videoUrl,
    videoStreamId: body.videoStreamId,
    videoPlaybackUrl: body.videoPlaybackUrl,
    videoStatus: body.videoStatus,
    title: body.title
  });

  if (!series) {
    return NextResponse.json(
      { ok: false, errorKey: "apiErrEpisodeNotFound", error: "Episode not found" },
      { status: 404 }
    );
  }

  invalidateSeriesCatalogCaches(params.id);
  return NextResponse.json({ ok: true, series });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; epId: string } }
) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const series = await deleteEpisodeFromSeries(params.id, params.epId);
  if (!series) {
    return NextResponse.json(
      {
        ok: false,
        errorKey: "apiErrEpisodeDeleteNotFound",
        error: "Could not delete this episode or drama was not found."
      },
      { status: 404 }
    );
  }
  invalidateSeriesCatalogCaches(params.id);
  return NextResponse.json({ ok: true, series });
}
