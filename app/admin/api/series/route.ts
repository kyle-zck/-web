import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { createSeries, getAllSeries } from "@/lib/series-repo";

export async function GET() {
  const unauth = requireAdminSession();
  if (unauth) return unauth;
  const series = await getAllSeries();
  return NextResponse.json({ ok: true, series });
}

export async function POST(req: Request) {
  const unauth = requireAdminSession();
  if (unauth) return unauth;

  const body = (await req.json()) as {
    title?: string;
    description?: string;
    tags?: string[];
    coverDataUrl?: string;
    episodeVideoUrls?: string[];
  };

  const title = body.title ?? "";
  const description = body.description ?? "";
  const tags = (body.tags ?? []) as any[];
  const coverDataUrl = body.coverDataUrl ?? "";
  const episodeVideoUrls = body.episodeVideoUrls ?? [];

  if (!title.trim() || !description.trim()) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!tags.length) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!coverDataUrl.trim()) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!episodeVideoUrls.length) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const series = await createSeries({
    title,
    description,
    tags: tags as any,
    coverDataUrl,
    episodeVideoUrls
  });

  return NextResponse.json({ ok: true, series });
}

