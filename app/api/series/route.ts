import { NextResponse } from "next/server";
import { getAllSeries } from "@/lib/series-repo";

/** 避免 `next build` 预渲染阶段连库（Vercel 上 DATABASE_URL 错误时构建会失败） */
export const dynamic = "force-dynamic";

export async function GET() {
  const all = await getAllSeries();
  const series = all.filter((s) => s.listed !== false);
  return NextResponse.json({ ok: true, series });
}

