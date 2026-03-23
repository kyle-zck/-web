import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { getS3Client, buildPublicUrl } from "@/lib/admin/s3";
import {
  hasCloudflareStreamConfig,
  tryCreateStreamByUrl,
  tryUploadFileToStream
} from "@/lib/video/cloudflare-stream";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

function sanitizeFilename(name: string) {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska"
]);

/** 管理端视频上传：无 S3 时写入 public/uploads/videos。生产大文件建议走直传对象存储并在表单中填写 HTTPS URL。 */
export async function POST(req: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const form = await req.formData();
  const file = form.get("file");
  const targetMode = String(form.get("targetMode") ?? "mp4").toLowerCase();
  const preferHls = targetMode === "hls";
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
  }

  const type = file.type || "";
  if (!VIDEO_TYPES.has(type) && !file.name.match(/\.(mp4|webm|mov|mkv)$/i)) {
    return NextResponse.json(
      { ok: false, error: "Unsupported video type (use mp4, webm, mov, mkv)" },
      { status: 400 }
    );
  }

  const maxSize = Number(process.env.ADMIN_VIDEO_UPLOAD_MAX_BYTES ?? 120 * 1024 * 1024);
  if (file.size > maxSize) {
    console.warn("[admin/upload/video] file too large", {
      name: file.name,
      size: file.size,
      maxSize
    });
    return NextResponse.json(
      {
        ok: false,
        errorKey: "apiErrVideoTooLarge",
        error: "Video file too large",
        maxSize,
        fileSize: file.size
      },
      { status: 400 }
    );
  }

  const bucket = process.env.S3_BUCKET ?? "";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? "";

  const arrayBuffer = await file.arrayBuffer();
  const bodyBuf = Buffer.from(arrayBuffer);

  // 手动选择 HLS 时，优先走 Cloudflare Stream 直传：不依赖 R2 公网可读 URL
  if (preferHls && hasCloudflareStreamConfig()) {
    const stream = await tryUploadFileToStream(file);
    if (stream.streamId && stream.playbackUrl) {
      return NextResponse.json({
        ok: true,
        videoUrl: stream.playbackUrl,
        videoStreamId: stream.streamId,
        videoPlaybackUrl: stream.playbackUrl,
        videoStatus: stream.status ?? "processing"
      });
    }
  }

  if (!bucket || !accessKeyId || !secretAccessKey) {
    const uploadsDir = path.resolve(process.cwd(), "public", "uploads", "videos");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const filename = `${Date.now()}-${sanitizeFilename(file.name || "video.mp4")}`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, bodyBuf);
    const videoUrl = `/uploads/videos/${filename}`;
    return NextResponse.json({
      ok: true,
      videoUrl,
      videoPlaybackUrl: videoUrl,
      videoStatus: "ready"
    });
  }

  const client = getS3Client();
  const key = `videos/${Date.now()}-${sanitizeFilename(file.name || "video.mp4")}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: bodyBuf,
      ContentType: type || "video/mp4",
      CacheControl: "public, max-age=31536000, immutable"
    })
  );

  const url = buildPublicUrl(key);
  const stream = preferHls ? await tryCreateStreamByUrl(url) : {};
  return NextResponse.json({
    ok: true,
    videoUrl: stream.playbackUrl ?? url,
    videoStreamId: stream.streamId,
    videoPlaybackUrl: stream.playbackUrl ?? url,
    videoStatus: stream.status ?? "ready"
  });
}
