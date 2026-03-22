import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { appendEpisodeToSeries } from "@/lib/series-repo/service";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const body = (await req.json()) as {
    videoUrl?: string;
    sourceFileName?: string;
    localVideoUrl?: string;
  };

  const videoUrl = (body.videoUrl ?? "").trim();
  if (!videoUrl) {
    return NextResponse.json(
      { ok: false, errorKey: "apiErrEpisodeVideoUrlRequired", error: "videoUrl is required" },
      { status: 400 }
    );
  }

  const series = await appendEpisodeToSeries(params.id, {
    videoUrl,
    sourceFileName: body.sourceFileName?.trim() || undefined,
    localVideoUrl: body.localVideoUrl?.trim() || undefined
  });

  if (!series) {
    return NextResponse.json(
      { ok: false, errorKey: "apiErrSeriesNotFound", error: "Series not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, series });
}
