import { NextResponse } from "next/server";
import { getAppConfigOrDefault } from "@/lib/app-config/service";

export { type AppConfig } from "@/lib/app-config/types";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getAppConfigOrDefault();
  return NextResponse.json(config, {
    headers: {
      // 公开配置可短缓存，减轻重复冷启动与 DB 读；后台改配置后最多约 30s 内边缘可能仍为旧数据
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120"
    }
  });
}
