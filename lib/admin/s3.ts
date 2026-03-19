import { S3Client } from "@aws-sdk/client-s3";

export function getS3Client() {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION ?? "us-east-1";
  const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? "";

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Missing S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY");
  }

  return new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(endpoint && !endpoint.includes(".amazonaws.com")),
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
}

export function buildPublicUrl(key: string) {
  const base = process.env.S3_PUBLIC_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${key}`;

  const endpoint = process.env.S3_ENDPOINT ?? "";
  const bucket = process.env.S3_BUCKET ?? "";
  if (!endpoint || !bucket) return key;

  const cleanEndpoint = endpoint.replace(/\/$/, "");
  return `${cleanEndpoint}/${bucket}/${key}`;
}

