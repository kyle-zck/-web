import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
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

  const existing = await getAllSeries();
  const duplicate = existing.some(
    (s) => s.title.trim().toLowerCase() === title.trim().toLowerCase()
  );
  if (duplicate) {
    return NextResponse.json(
      { ok: false, errorKey: "apiErrDuplicateDramaTitle", error: "A drama with this title already exists" },
      { status: 400 }
    );
  }

  const categoryTags = tags.filter((t): t is import("@/constants/mock-data").CategoryTag =>
    ["Romance", "Revenge", "Werewolf", "CEO", "Fantasy", "Time Travel"].includes(t)
  );
  const finalTags = categoryTags.length ? categoryTags : (["Romance"] as any);

  const series = await createSeries({
    title,
    description,
    tags: finalTags,
    coverDataUrl,
    episodeVideoUrls,
    episodeVideoMeta: body.episodeVideoMeta,
    lockStartIndex,
    listed,
    originalName,
    localOrTranslated
  });

  return NextResponse.json({ ok: true, series });
}

