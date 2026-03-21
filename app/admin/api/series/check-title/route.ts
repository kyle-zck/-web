import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { getAllSeries } from "@/lib/series-repo";

export async function POST(req: Request) {
  const unauth = requireAdminSession();
  if (unauth) return unauth;

  const { title } = (await req.json()) as { title?: string };
  const name = (title ?? "").trim();
  if (!name) {
    return NextResponse.json({ ok: true, duplicate: false });
  }

  const series = await getAllSeries();
  const duplicate = series.some(
    (s) => s.title.trim().toLowerCase() === name.toLowerCase()
  );
  return NextResponse.json({ ok: true, duplicate });
}
