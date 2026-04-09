import { NextResponse } from "next/server";
import { invalidateSeriesCatalogCaches } from "@/lib/cache/invalidate-data-cache";
import { requireAdminSession } from "@/lib/admin/auth";
import { validateTagsAgainstCatalog } from "@/lib/drama-tag-catalog/validate";
import { createSeries, getAllSeries } from "@/lib/series-repo";

export async function GET() {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  const series = await getAllSeries();
  return NextResponse.json({ ok: true, series });
}

export async function POST(req: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  const traceId = `series-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const body = (await req.json()) as {
      title?: string;
      description?: string;
      tags?: string[];
      coverDataUrl?: string;
      episodeVideoUrls?: string[];
      episodeVideoMeta?: { fileName: string; localVideoUrl?: string }[];
      lockStartIndex?: number;
      listed?: boolean;
      originalName?: string;
      localOrTranslated?: "local" | "translated";
    };

    const title = body.title ?? "";
    const description = body.description ?? "";
    const tags = (body.tags ?? []) as string[];
    const coverDataUrl = body.coverDataUrl ?? "";
    const episodeVideoUrls = body.episodeVideoUrls ?? [];
    const lockStartIndex = body.lockStartIndex;
    const listed = body.listed;
    const originalName = body.originalName;
    const localOrTranslated = body.localOrTranslated;

    if (!title.trim() || !description.trim()) {
      return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
    }
    if (!tags.length) {
      return NextResponse.json({ ok: false, error: "Select at least one tag" }, { status: 400 });
    }
    if (!coverDataUrl.trim()) {
      return NextResponse.json({ ok: false, error: "Upload cover" }, { status: 400 });
    }
    if (!episodeVideoUrls.length) {
      return NextResponse.json({ ok: false, error: "Upload videos" }, { status: 400 });
    }

    const tagCheck = await validateTagsAgainstCatalog(tags);
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

    const series = await createSeries({
      title,
      description,
      tags,
      coverDataUrl,
      episodeVideoUrls,
      episodeVideoMeta: body.episodeVideoMeta,
      lockStartIndex,
      listed,
      originalName,
      localOrTranslated
    });

    invalidateSeriesCatalogCaches(series.id);
    return NextResponse.json({ ok: true, series });
  } catch (err) {
    const message =
      err instanceof Error ? err.message.slice(0, 240) : "Unknown server error";
    console.error(`[admin/api/series] create series failed [${traceId}]:`, err);

    // DUPLICATE_TITLE is thrown by storage-pg as a lightweight duplicate check
    if (err instanceof Error && err.message === "DUPLICATE_TITLE") {
      return NextResponse.json(
        { ok: false, errorKey: "apiErrDuplicateDramaTitle", error: "A drama with this title already exists" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        errorKey: "apiErrCreateSeriesFailed",
        error: `Create series failed: ${message}`,
        traceId
      },
      { status: 500 }
    );
  }
}

