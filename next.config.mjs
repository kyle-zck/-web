/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // better-sqlite3 为原生模块；动态 import 后仍避免被打进无关服务端 chunk
  experimental: {
    serverComponentsExternalPackages: ["better-sqlite3"]
  }
};

export default nextConfig;
