import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  /** 仅当 `ANALYZE=true` 时启用，避免拖慢日常 build */
  enabled: process.env.ANALYZE === "true",
  /** 报告写入磁盘，由你本地打开 HTML（CI/无界面环境不弹窗） */
  openAnalyzer: false
});

/** @type {import('next').NextConfig} */
const imageRemotePatterns = [
  {
    protocol: "https",
    hostname: "**.r2.dev"
  }
];

if (process.env.S3_PUBLIC_BASE_URL) {
  try {
    const parsed = new URL(process.env.S3_PUBLIC_BASE_URL);
    imageRemotePatterns.push({
      protocol: parsed.protocol.replace(":", ""),
      hostname: parsed.hostname
    });
  } catch {
    // ignore invalid S3_PUBLIC_BASE_URL
  }
}

/** 本站 /api/video/proxy：供 next/image 优化器拉取同源代理海报（需配置 NEXT_PUBLIC_SITE_URL） */
if (process.env.NEXT_PUBLIC_SITE_URL) {
  try {
    const site = new URL(process.env.NEXT_PUBLIC_SITE_URL);
    imageRemotePatterns.push({
      protocol: site.protocol.replace(":", ""),
      hostname: site.hostname,
      ...(site.port ? { port: site.port } : {}),
      pathname: "/api/video/proxy"
    });
  } catch {
    // ignore
  }
}

const nextConfig = {
  reactStrictMode: true,
  // better-sqlite3 为原生模块；动态 import 后仍避免被打进无关服务端 chunk
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3", "ioredis"],
    /** 减小 barrel import 体积；配合 package.json browserslist 减轻「旧版 JS」与未使用代码感知 */
    optimizePackageImports: [
      "recharts",
      "zustand",
      "react-i18next",
      "i18next",
      "@supabase/supabase-js"
    ],
    /** 依赖 devDependency `critters`：内联关键 CSS，缓解「渲染屏蔽 / LCP」 */
    optimizeCss: true
  },
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false
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
      },
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        source: "/_next/image",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, must-revalidate"
          }
        ]
      }
    ];
  },
  images: {
    remotePatterns: [
      ...imageRemotePatterns,
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.supabase.in" }
    ],
    formats: ["image/avif", "image/webp"],
    /** 远程优化图在 CDN/浏览器侧可缓存更久，减轻 Lighthouse「缓存生命周期」提示 */
    minimumCacheTTL: 86400,
    /** 移动优先：略收窄 deviceSizes，减少同屏多海报时生成过大 srcset */
    deviceSizes: [360, 414, 640, 750, 828, 1080, 1200, 1920],
    /** 与海报 sizes（约 160–280px）对齐，避免生成偏大 w（Lighthouse「改进图片传送」） */
    imageSizes: [16, 32, 48, 64, 96, 120, 128, 192, 224, 256, 384]
  }
};

export default withBundleAnalyzer(nextConfig);
