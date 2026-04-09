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

/**
 * Returns the fast R2 public endpoint to embed in presigned upload URLs.
 * Preferring `r2.dev` subdomain over `cloudflarestorage.com` avoids the extra
 * TLS handshake penalty observed on the `cloudflarestorage.com` path-style URL.
 */
function buildUploadEndpoint(): { base: string; usePathStyle: boolean } {
  const bucket = process.env.S3_BUCKET ?? "";
  const customPublicBase = process.env.S3_PUBLIC_BASE_URL?.trim();

  if (customPublicBase) {
    const hasR2Dev = customPublicBase.includes(".r2.dev");
    const hasCloudflareStorage = customPublicBase.includes(".cloudflarestorage.com");
    if (hasR2Dev || hasCloudflareStorage) {
      // Extract origin from custom URL (e.g. https://pub-xxx.r2.dev)
      try {
        const url = new URL(customPublicBase);
        return { base: url.origin, usePathStyle: false };
      } catch {
        // fall through to R2.dev default
      }
    }
  }

  // Fallback: use R2.dev subdomain of the account — fast TLS via Cloudflare.
  const accountId = process.env.S3_ENDPOINT?.match(/\/(\d+)\.r2\./)?.[1] ?? "";
  if (accountId) {
    return { base: `https://web.${accountId}.r2.dev`, usePathStyle: false };
  }

  // Last resort: use whatever S3_ENDPOINT is configured (path-style)
  return {
    base: (process.env.S3_ENDPOINT ?? "").replace(/\/$/, ""),
    usePathStyle: true,
  };
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
  const { base: uploadBase, usePathStyle } = buildUploadEndpoint();
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
      const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 15 });

      // Replace the default cloudflarestorage.com endpoint with the faster r2.dev endpoint
      // so the browser negotiates TLS with Cloudflare directly instead of the slower path-style URL.
      let fastUploadUrl = uploadUrl;
      if (uploadBase && !uploadUrl.includes(uploadBase)) {
        try {
          const parsed = new URL(uploadUrl);
          const parsedBase = new URL(uploadBase);
          // Replace host + path prefix: cloudflarestorage.com/bucket → r2.dev
          if (usePathStyle) {
            parsed.hostname = parsedBase.hostname;
          } else {
            parsed.hostname = parsedBase.hostname;
            // Strip the /bucket/ prefix from the path since r2.dev uses virtual-hosted style
            const pathWithoutBucket = parsed.pathname.replace(/^\/[^/]+\//, "/");
            parsed.pathname = pathWithoutBucket;
          }
          fastUploadUrl = parsed.toString();
        } catch {
          // Fall back to original URL if URL manipulation fails
          fastUploadUrl = uploadUrl;
        }
      }

      return { fileName, key, uploadUrl: fastUploadUrl, publicUrl: buildPublicUrl(key) };
    })
  );

  return NextResponse.json({ ok: true, items: results });
}
