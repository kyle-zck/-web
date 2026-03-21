import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { deleteEpisodeFromSeries } from "@/lib/series-repo/service";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; epId: string } }
) {
  const unauth = requireAdminSession();
  if (unauth) return unauth;

  const series = await deleteEpisodeFromSeries(params.id, params.epId);
  if (!series) {
    return NextResponse.json(
      {
        ok: false,
        errorKey: "apiErrEpisodeDeleteNotFound",
        error:
          "Could not delete this episode or drama was not found. Deleting a single episode is only supported when using local JSON storage (not SQLite/Postgres)."
      },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, series });
}
