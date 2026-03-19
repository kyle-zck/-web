import { NextResponse } from "next/server";
import { getAllSeries } from "@/lib/series-repo";

export async function GET() {
  const series = await getAllSeries();
  return NextResponse.json({ ok: true, series });
}

