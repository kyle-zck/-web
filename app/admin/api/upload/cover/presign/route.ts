import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { getS3Client } from "@/lib/admin/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function sanitizeFilename(name: string) {
  return name
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function buildPublicUrl(key: string): string {
  const base = process.env.S3_PUBLIC_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${key}`;

  const endpoint = process.env.S3_ENDPOINT ?? "";
  const bucket = process.env.S3_BUCKET ?? "";
  if (!endpoint || !bucket) return key;

  const cleanEndpoint = endpoint.replace(/\/$/, "");
  return `${cleanEndpoint}/${bucket}/${key}`;
}

export async function POST(req: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const bucket = process.env.S3_BUCKET ?? "";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? "";
  if (!bucket || !accessKeyId || !secretAccessKey) {
    return NextResponse.json(
      { ok: false, errorKey: "apiErrStorageNotConfigured", error: "Object storage is not configured" },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { fileName?: string };
  const rawName = (body.fileName ?? "cover").trim();
  const safeName = sanitizeFilename(rawName);
  const finalName = safeName.endsWith(".webp") ? safeName : `${safeName}.webp`;
  const key = `covers/${Date.now()}-${finalName}`;

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: "image/webp",
    CacheControl: "public, max-age=31536000, immutable"
  });

  // Presigned URL 绑定到 S3_ENDPOINT，不可用它构建永久公开 URL。
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 120 });

  // 永久公开 URL（不含签名凭证）
  const publicUrl = buildPublicUrl(key);

  return NextResponse.json({ ok: true, key, uploadUrl, publicUrl });
}
