import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getS3Client } from "@/lib/admin/s3";

function notAllowed() {
  return NextResponse.json({ ok: false, error: "Invalid source" }, { status: 400 });
}

function extractKeyFromSrc(src: string): string | null {
  try {
    const parsed = new URL(src);
    const host = parsed.hostname.toLowerCase();
    const isR2Public = host.endsWith(".r2.dev");
    const configuredHost = (() => {
      try {
        const base = process.env.S3_PUBLIC_BASE_URL?.trim();
        return base ? new URL(base).hostname.toLowerCase() : "";
      } catch {
        return "";
      }
    })();
    if (!isR2Public && (!configuredHost || host !== configuredHost)) return null;
    const key = parsed.pathname.replace(/^\/+/, "");
    return key || null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const src = new URL(req.url).searchParams.get("src")?.trim() || "";
  if (!src) return notAllowed();

  const key = extractKeyFromSrc(src);
  if (!key) return notAllowed();

  const bucket = process.env.S3_BUCKET?.trim() || "";
  if (!bucket) {
    return NextResponse.json({ ok: false, error: "Storage bucket is not configured" }, { status: 500 });
  }

  const range = req.headers.get("range") ?? undefined;

  try {
    const client = getS3Client();
    const object = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        Range: range
      })
    );

    const headers = new Headers();
    headers.set("Accept-Ranges", "bytes");

    // 告知中间缓存（Vercel/CDN）Range 请求不可复用普通缓存，避免串台
    if (range) {
      headers.set("Cache-Control", "no-store");
    }
    const ct = object.ContentType ?? "";
    const isImage = ct.startsWith("image/");
    const isVideo = ct.startsWith("video/");
    // 海报/静态图：长缓存（R2 对象键通常随版本变）；视频：支持 Range，中等缓存
    if (isImage) {
      headers.set(
        "Cache-Control",
        "public, max-age=2592000, stale-while-revalidate=604800, immutable"
      );
    } else if (isVideo) {
      headers.set(
        "Cache-Control",
        "public, max-age=86400, stale-while-revalidate=604800"
      );
    } else {
      headers.set("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
    }
    if (object.ContentType) headers.set("Content-Type", object.ContentType);
    if (object.ContentLength !== undefined) headers.set("Content-Length", String(object.ContentLength));
    if (object.ETag) headers.set("ETag", object.ETag);
    if (object.LastModified) headers.set("Last-Modified", object.LastModified.toUTCString());
    if (object.ContentRange) headers.set("Content-Range", object.ContentRange);

    // Stream directly without buffering the full body in memory.
    // In Node.js, object.Body is a Readable stream — Response accepts it as-is.
    // AWS SDK typings are wider than BodyInit; cast to satisfy TS.
    const body = object.Body as BodyInit | undefined;

    return new Response(body, {
      status: range && object.ContentRange ? 206 : 200,
      headers
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to proxy video";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

