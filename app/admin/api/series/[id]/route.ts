import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { deleteSeries, updateSeries } from "@/lib/series-repo";
import type { CategoryTag } from "@/constants/mock-data";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  await deleteSeries(params.id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  const body = (await req.json()) as {
    lockStartIndex?: number;
    title?: string;
    originalName?: string;
    localOrTranslated?: "local" | "translated";
    description?: string;
    tags?: string[];
    cover?: string;
    poster?: string;
    listed?: boolean;
  };
  const series = await updateSeries(params.id, {
    ...body,
    tags: body.tags as CategoryTag[] | undefined
  });
  if (!series) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, series });
}

