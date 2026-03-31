import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { tryCreateStreamByUrl } from "@/lib/video/cloudflare-stream";
import { hasCloudflareStreamConfig } from "@/lib/video/cloudflare-stream";

type VideoMeta = {
  uploadedKey: string;
  uploadedUrl: string;
  targetMode?: string;
};

export async function POST(req: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const body = (await req.json().catch(() => ({}))) as {
    videos?: VideoMeta[];
  };
  const videos = body.videos ?? [];
  if (videos.length === 0) {
    return NextResponse.json({ ok: false, error: "Missing videos" }, { status: 400 });
  }
  if (videos.length > 100) {
    return NextResponse.json({ ok: false, error: "Max 100 videos per batch" }, { status: 400 });
  }

  const preferHls = (v: VideoMeta) =>
    String(v.targetMode ?? "mp4").toLowerCase() === "hls";

  const results = await Promise.all(
    videos.map(async (v) => {
      const url = v.uploadedUrl;
      const prefer = preferHls(v);
      let stream: Awaited<ReturnType<typeof tryCreateStreamByUrl>> = {};
      if (prefer && hasCloudflareStreamConfig()) {
        stream = await tryCreateStreamByUrl(url);
      }
      // MP4：uploadedUrl 本身已是 R2 CDN 公有 URL，直接作为 videoPlaybackUrl
      // HLS：走 Cloudflare Stream 获得的 playbackUrl 作为 videoPlaybackUrl
      const finalPlaybackUrl = stream.playbackUrl ?? url;
      return {
        videoUrl: finalPlaybackUrl,
        videoStreamId: stream.streamId,
        videoPlaybackUrl: finalPlaybackUrl,
        videoStatus: stream.status ?? "ready"
      };
    })
  );

  return NextResponse.json({ ok: true, items: results });
}
