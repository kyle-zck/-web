import { S3Client } from "@aws-sdk/client-s3";

/**
 * S3 兼容存储（AWS S3 / Cloudflare R2 / MinIO 等）。
 * R2：S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 *      S3_REGION=auto（或未设置时含 r2 域名则默认 auto）
 *      S3_PUBLIC_BASE_URL=自定义域名或 R2 dev 子域公开 URL
 *
 * S3Client 实例在冷启动后会被 Node.js 缓存，不会每次调用重新创建。
 * 仅当环境变量变更时才重新实例化。
 */
let _cachedClient: S3Client | null = null;
let _cachedEnv = "";

function envKey() {
  return [
    process.env.S3_ENDPOINT,
    process.env.S3_REGION,
    process.env.S3_ACCESS_KEY_ID,
    process.env.S3_SECRET_ACCESS_KEY,
  ].join("|");
}

export function getS3Client() {
  const env = envKey();
  if (_cachedClient && env === _cachedEnv) return _cachedClient;

  const endpoint = process.env.S3_ENDPOINT?.trim();
  const isR2 = Boolean(endpoint?.includes("r2.cloudflarestorage.com"));
  const region =
    process.env.S3_REGION?.trim() ||
    (isR2 ? "auto" : "us-east-1");
  const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? "";

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Missing S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY");
  }

  _cachedClient = new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(
      endpoint && !endpoint.includes(".amazonaws.com")
    ),
    // Prevent optional checksum headers from being injected for presigned PUT,
    // which often trigger CORS preflight header rejections on R2.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
  _cachedEnv = env;
  return _cachedClient;
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

