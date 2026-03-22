import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { readCatalog } from "@/lib/drama-tag-catalog/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function parseRevalidate(envVal: string | undefined, fallback: number) {
  if (envVal == null || envVal === "") return fallback;
  const n = Number(envVal);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const tagRevalidate = parseRevalidate(process.env.PUBLIC_TAG_CATALOG_REVALIDATE, 300);

const getTagCatalogCached = unstable_cache(
  async () => {
    const { items } = await readCatalog();
    return items.map((i) => ({ id: i.id, name: i.name }));
  },
  ["public-tag-catalog-v1"],
  { revalidate: Math.max(1, tagRevalidate) }
);

/** 前台 Explore 等：读取「管理标签」目录（无需登录） */
export async function GET() {
  try {
    const items = await getTagCatalogCached();
    return NextResponse.json(
      { ok: true, items },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${tagRevalidate}, stale-while-revalidate=600`
        }
      }
    );
  } catch (e) {
    console.error("[tag-catalog] GET:", e);
    return NextResponse.json({ ok: true, items: [] });
  }
}
