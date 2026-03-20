import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { deleteSeries, updateSeries } from "@/lib/series-repo";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const unauth = requireAdminSession();
  if (unauth) return unauth;
  await deleteSeries(params.id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const unauth = requireAdminSession();
  if (unauth) return unauth;
  const body = (await req.json()) as { lockStartIndex?: number };
  const series = await updateSeries(params.id, {
    lockStartIndex: body.lockStartIndex
  });
  if (!series) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, series });
}

