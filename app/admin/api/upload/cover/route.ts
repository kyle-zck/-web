import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { getS3Client, buildPublicUrl } from "@/lib/admin/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";
import sharp from "sharp";

const MAX_WIDTH = 1200;
const WEBP_QUALITY = 75;

function sanitizeFilename(name: string) {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

/**
 * 用 sharp 把图片压成 WebP，质量 75，最宽 MAX_WIDTH px。
 * 返回 Buffer（不改动原始文件），抛出 Error 时返回 null。
 */
async function compressToWebP(body: Buffer): Promise<Buffer> {
  let pipeline = sharp(body);
  const meta = await pipeline.metadata();
  if ((meta.width ?? 0) > MAX_WIDTH) {
    pipeline = pipeline.resize(MAX_WIDTH, undefined, { withoutEnlargement: true });
  }
  return pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
}

export async function POST(req: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "File must be an image" }, { status: 400 });
  }

  const maxSize = 6 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json({ ok: false, error: "File too large (max 6MB)" }, { status: 400 });
  }

  const bucket = process.env.S3_BUCKET ?? "";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? "";

  const arrayBuffer = await file.arrayBuffer();
  const body = Buffer.from(arrayBuffer);

  // Dev fallback：未配置 S3 时，写入 public 目录返回本地 URL
  // 本地开发也走压缩，统一上传体验
  let webpBody: Buffer;
  try {
    webpBody = await compressToWebP(body);
  } catch (e) {
    console.error("[cover-upload] sharp compress failed:", e);
    return NextResponse.json({ ok: false, error: "Failed to process image" }, { status: 422 });
  }

  if (!bucket || !accessKeyId || !secretAccessKey) {
    // 生产环境必须使用对象存储，否则 URL 在无状态实例中会 404。
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      console.error("[cover-upload] S3 env not configured:", { bucket, hasKey: !!accessKeyId, hasSecret: !!secretAccessKey });
      return NextResponse.json(
        {
          ok: false,
          errorKey: "apiErrStorageNotConfigured",
          error: "Object storage is not configured in production"
        },
        { status: 400 }
      );
    }
    const uploadsDir = path.resolve(process.cwd(), "public", "uploads", "covers");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const filename = `${Date.now()}-${sanitizeFilename(file.name || "cover")}.webp`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, webpBody);
    return NextResponse.json({ ok: true, coverUrl: `/uploads/covers/${filename}` });
  }

  const client = getS3Client();
  const key = `covers/${Date.now()}-${sanitizeFilename(file.name || "cover")}.webp`;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: webpBody,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable"
      })
    );
  } catch (e) {
    console.error("[cover-upload] S3 PutObject failed:", e);
    return NextResponse.json({ ok: false, error: "Failed to upload to storage" }, { status: 500 });
  }

  const url = buildPublicUrl(key);
  return NextResponse.json({ ok: true, coverUrl: url });
}

