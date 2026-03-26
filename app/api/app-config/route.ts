import { NextResponse } from "next/server";
import { getAppConfigOrDefault } from "@/lib/app-config/service";

export { type AppConfig } from "@/lib/app-config/types";
export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getAppConfigOrDefault();
  return NextResponse.json(config, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  });
}
