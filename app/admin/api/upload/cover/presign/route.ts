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
  // 文件名可能已含 .webp 后缀（如 "photo.webp"），去重避免 "photo.webp.webp"
  const finalName = safeName.endsWith(".webp") ? safeName : `${safeName}.webp`;
  const key = `covers/${Date.now()}-${finalName}`;

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: "image/webp",
    CacheControl: "public, max-age=31536000, immutable"
  });

// Presigned URLs are bound to the S3_ENDPOINT host — never rewrite the URL,
// or the signature becomes invalid and causes 403.
const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 120 }); // 2 hours

  return NextResponse.json({ ok: true, key, uploadUrl });
}
