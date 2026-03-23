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

  const contentType = req.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const bodyJson = isJson
    ? ((await req.json().catch(() => ({}))) as {
        uploadedKey?: string;
        uploadedUrl?: string;
        targetMode?: string;
      })
    : null;
  const form = !isJson ? await req.formData() : null;
  const file = form?.get("file");
  const targetMode = String(
    isJson ? bodyJson?.targetMode ?? "mp4" : form?.get("targetMode") ?? "mp4"
  ).toLowerCase();
  const preferHls = targetMode === "hls";
  const uploadedKey = (bodyJson?.uploadedKey ?? "").trim();
  const uploadedUrl = (bodyJson?.uploadedUrl ?? "").trim();
  if (!(file instanceof File) && !uploadedKey && !uploadedUrl) {
    return NextResponse.json(
      { ok: false, error: "Missing file or uploadedKey/uploadedUrl" },
      { status: 400 }
    );
  }

  const type = file instanceof File ? file.type || "" : "video/mp4";
  if (
    file instanceof File &&
    !VIDEO_TYPES.has(type) &&
    !file.name.match(/\.(mp4|webm|mov|mkv)$/i)
  ) {
    return NextResponse.json(
      { ok: false, error: "Unsupported video type (use mp4, webm, mov, mkv)" },
      { status: 400 }
    );
  }

  const maxSize = Number(process.env.ADMIN_VIDEO_UPLOAD_MAX_BYTES ?? 120 * 1024 * 1024);
  if (file instanceof File && file.size > maxSize) {
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

  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : null;
  const bodyBuf = arrayBuffer ? Buffer.from(arrayBuffer) : null;

  // 手动选择 HLS 时，优先走 Cloudflare Stream 直传：不依赖 R2 公网可读 URL
  if (file instanceof File && preferHls && hasCloudflareStreamConfig()) {
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
    // Vercel 等无状态环境中，本地 public/uploads 不是持久存储，不能作为生产视频源。
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      return NextResponse.json(
        {
          ok: false,
          errorKey: "apiErrStorageNotConfigured",
          error: "Object storage is not configured in production"
        },
        { status: 400 }
      );
    }
    const uploadsDir = path.resolve(process.cwd(), "public", "uploads", "videos");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const filename = `${Date.now()}-${sanitizeFilename((file as File)?.name || "video.mp4")}`;
    const filePath = path.join(uploadsDir, filename);
    if (!bodyBuf) {
      return NextResponse.json(
        { ok: false, error: "uploadedKey/uploadedUrl requires object storage in non-local mode" },
        { status: 400 }
      );
    }
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
  let key = uploadedKey;
  let url = uploadedUrl;
  if (!key && !url) {
    key = `videos/${Date.now()}-${sanitizeFilename((file as File)?.name || "video.mp4")}`;
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bodyBuf ?? undefined,
        ContentType: type || "video/mp4",
        CacheControl: "public, max-age=31536000, immutable"
      })
    );
    url = buildPublicUrl(key);
  }
  if (!url && key) url = buildPublicUrl(key);
  if (!url) {
    return NextResponse.json({ ok: false, error: "Missing uploaded URL" }, { status: 400 });
  }
  const stream = preferHls ? await tryCreateStreamByUrl(url) : {};
  return NextResponse.json({
    ok: true,
    videoUrl: stream.playbackUrl ?? url,
    videoStreamId: stream.streamId,
    videoPlaybackUrl: stream.playbackUrl ?? url,
    videoStatus: stream.status ?? "ready"
  });
}
