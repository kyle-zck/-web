import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "tags.json");

function readTags() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { categories: [], tags: [] };
  }
}

function writeTags(data: { categories: unknown[]; tags: unknown[] }) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  const data = readTags();
  return NextResponse.json({ ok: true, ...data });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { action, ...payload } = body;
  const data = readTags();

  if (action === "addCategory") {
    const { id, nameZh, nameEn, nameJp } = payload;
    if (data.categories.some((c: { id: string }) => c.id === id)) {
      return NextResponse.json(
        { ok: false, errorKey: "apiErrCategoryExists", error: "Category already exists" },
        { status: 400 }
      );
    }
    data.categories.push({ id, nameZh, nameEn, nameJp });
    writeTags(data);
    return NextResponse.json({ ok: true });
  }

  if (action === "addTag") {
    const { nameZh, nameEn, nameJp, categoryId } = payload;
    const id = `t${Date.now()}`;
    data.tags.push({ id, nameZh: nameZh || "", nameEn: nameEn || "", nameJp: nameJp || "", categoryId });
    writeTags(data);
    return NextResponse.json({ ok: true, id });
  }

  if (action === "updateTag") {
    const { id, nameZh, nameEn, nameJp, categoryId } = payload;
    const idx = data.tags.findIndex((t: { id: string }) => t.id === id);
    if (idx < 0) {
      return NextResponse.json(
        { ok: false, errorKey: "apiErrI18nTagNotFound", error: "Tag not found" },
        { status: 404 }
      );
    }
    if (nameZh != null) data.tags[idx].nameZh = nameZh;
    if (nameEn != null) data.tags[idx].nameEn = nameEn;
    if (nameJp != null) data.tags[idx].nameJp = nameJp;
    if (categoryId != null) data.tags[idx].categoryId = categoryId;
    writeTags(data);
    return NextResponse.json({ ok: true });
  }

  if (action === "deleteTag") {
    const { id } = payload;
    data.tags = data.tags.filter((t: { id: string }) => t.id !== id);
    writeTags(data);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { ok: false, errorKey: "apiErrUnknownAction", error: "Unknown action" },
    { status: 400 }
  );
}
