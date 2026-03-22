import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getAppConfigOrDefault } from "@/lib/app-config/service";

export { type AppConfig } from "@/lib/app-config/types";

function parseRevalidate(envVal: string | undefined, fallback: number) {
  if (envVal == null || envVal === "") return fallback;
  const n = Number(envVal);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** 与 /api/series 一致：服务端跨请求缓存 + 浏览器/CDN 可缓存 JSON */
const appConfigRevalidate = parseRevalidate(process.env.PUBLIC_APP_CONFIG_REVALIDATE, 120);

const getAppConfigCached = unstable_cache(
  async () => getAppConfigOrDefault(),
  ["public-app-config-v1"],
  { revalidate: Math.max(1, appConfigRevalidate) }
);

export async function GET() {
  const config = await getAppConfigCached();
  return NextResponse.json(config, {
    headers: {
      "Cache-Control": `public, s-maxage=${appConfigRevalidate}, stale-while-revalidate=600`
    }
  });
}
