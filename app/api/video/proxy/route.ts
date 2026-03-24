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
    headers.set("Cache-Control", "public, max-age=600");
    if (object.ContentType) headers.set("Content-Type", object.ContentType);
    if (object.ContentLength !== undefined) headers.set("Content-Length", String(object.ContentLength));
    if (object.ETag) headers.set("ETag", object.ETag);
    if (object.LastModified) headers.set("Last-Modified", object.LastModified.toUTCString());
    if (object.ContentRange) headers.set("Content-Range", object.ContentRange);

    return new Response(object.Body as BodyInit, {
      status: range && object.ContentRange ? 206 : 200,
      headers
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to proxy video";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}

