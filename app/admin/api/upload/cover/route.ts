import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { getS3Client, buildPublicUrl } from "@/lib/admin/s3";
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
  if (!bucket || !accessKeyId || !secretAccessKey) {
    const uploadsDir = path.resolve(process.cwd(), "public", "uploads", "covers");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
    const filename = `${Date.now()}-${sanitizeFilename(file.name || "cover.jpg")}`;
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, body);
    return NextResponse.json({ ok: true, coverUrl: `/uploads/covers/${filename}` });
  }

  const client = getS3Client();
  const key = `covers/${Date.now()}-${sanitizeFilename(file.name || "cover.jpg")}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: file.type,
      CacheControl: "public, max-age=31536000, immutable"
    })
  );

  const url = buildPublicUrl(key);
  return NextResponse.json({ ok: true, coverUrl: url });
}

