import { NextResponse } from "next/server";
import { getAllSeries } from "@/lib/series-repo";

export async function GET() {
  const all = await getAllSeries();
  const series = all.filter((s) => s.listed !== false);
  return NextResponse.json({ ok: true, series });
}

