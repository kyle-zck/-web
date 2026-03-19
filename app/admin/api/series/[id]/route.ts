import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { deleteSeries } from "@/lib/series-repo";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const unauth = requireAdminSession();
  if (unauth) return unauth;
  await deleteSeries(params.id);
  return NextResponse.json({ ok: true });
}

