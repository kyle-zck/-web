import { NextResponse } from "next/server";
import { getSeriesById } from "@/lib/series-repo";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const series = await getSeriesById(params.id);
  if (!series) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json(
    { ok: true, series },
    {
      headers: {
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300"
      }
    }
  );
}

