import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { validateTagsAgainstCatalog } from "@/lib/drama-tag-catalog/validate";
import { deleteSeries, updateSeries } from "@/lib/series-repo";

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
  if (body.tags && body.tags.length > 0) {
    const tagCheck = await validateTagsAgainstCatalog(body.tags);
    if (!tagCheck.ok) {
      return NextResponse.json(
        {
          ok: false,
          errorKey: "apiErrTagsNotInCatalog",
          error: `Tags must come from Manage tags: ${tagCheck.invalid.join(", ")}`
        },
        { status: 400 }
      );
    }
  }

  const series = await updateSeries(params.id, {
    ...body,
    tags: body.tags
  });
  if (!series) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, series });
}

