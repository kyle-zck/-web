import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { getS3Client, buildPublicUrl } from "@/lib/admin/s3";
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
      {
        ok: false,
        errorKey: "apiErrStorageNotConfigured",
        error: "Object storage is not configured"
      },
      { status: 400 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    files?: Array<{ fileName: string; contentType?: string }>;
  };
  const files = body.files ?? [];
  if (files.length === 0) {
    return NextResponse.json({ ok: false, error: "Missing files" }, { status: 400 });
  }
  if (files.length > 100) {
    return NextResponse.json({ ok: false, error: "Max 100 files per batch" }, { status: 400 });
  }

  const client = getS3Client();
  const results = await Promise.all(
    files.map(async ({ fileName, contentType }) => {
      const key = `videos/${Date.now()}-${Math.random().toString(36).slice(2)}-${sanitizeFilename(fileName ?? "video.mp4")}`;
      const type = (contentType ?? "video/mp4").trim();
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: type,
        CacheControl: "public, max-age=31536000, immutable"
      });
      // NOTE: Presigned URLs are bound to the S3_ENDPOINT host and must NOT be
      // rewritten — doing so invalidates the signature and causes 403 errors.
      const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 15 });
      return { fileName, key, uploadUrl, publicUrl: buildPublicUrl(key) };
    })
  );

  return NextResponse.json({ ok: true, items: results });
}
