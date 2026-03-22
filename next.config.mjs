/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // better-sqlite3 为原生模块；动态 import 后仍避免被打进无关服务端 chunk
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"]
  },
  /** 本地上传到 public/uploads 的资源：长缓存（文件名通常含时间戳；生产封面建议走 S3/R2 URL） */
  async headers() {
    return [
      {
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
