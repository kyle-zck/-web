import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { requireAdminSession } from "@/lib/admin/auth";

const DATA_PATH = path.join(process.cwd(), "data", "drama-tag-catalog.json");

type CatalogItem = { id: string; name: string };

function readCatalog(): { items: CatalogItem[] } {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const data = JSON.parse(raw) as { items?: CatalogItem[] };
    return { items: Array.isArray(data.items) ? data.items : [] };
  } catch {
    return { items: [] };
  }
}

function writeCatalog(data: { items: CatalogItem[] }) {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  const data = readCatalog();
  return NextResponse.json({ ok: true, items: data.items });
}

export async function POST(req: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const body = (await req.json()) as {
    action?: string;
    name?: string;
    id?: string;
  };
  const { action, name, id } = body;
  const data = readCatalog();

  if (action === "add") {
    const trimmed = (name ?? "").trim();
    if (!trimmed) {
      return NextResponse.json(
        { ok: false, errorKey: "apiErrCatalogTagNameEmpty", error: "Tag name cannot be empty" },
        { status: 400 }
      );
    }
    if (data.items.some((i) => i.name === trimmed)) {
      return NextResponse.json(
        { ok: false, errorKey: "apiErrCatalogTagDuplicate", error: "This tag already exists" },
        { status: 400 }
      );
    }
    const newId = `dt-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    data.items.push({ id: newId, name: trimmed });
    writeCatalog(data);
    return NextResponse.json({ ok: true, item: { id: newId, name: trimmed } });
  }

  if (action === "update") {
    const trimmed = (name ?? "").trim();
    if (!id) {
      return NextResponse.json(
        { ok: false, errorKey: "apiErrCatalogMissingId", error: "Missing id" },
        { status: 400 }
      );
    }
    if (!trimmed) {
      return NextResponse.json(
        { ok: false, errorKey: "apiErrCatalogTagNameEmpty", error: "Tag name cannot be empty" },
        { status: 400 }
      );
    }
    const idx = data.items.findIndex((i) => i.id === id);
    if (idx < 0) {
      return NextResponse.json(
        { ok: false, errorKey: "apiErrCatalogTagMissing", error: "Tag not found" },
        { status: 404 }
      );
    }
    if (data.items.some((i, i2) => i2 !== idx && i.name === trimmed)) {
      return NextResponse.json(
        { ok: false, errorKey: "apiErrCatalogNameDuplicate", error: "This name is already in use" },
        { status: 400 }
      );
    }
    data.items[idx] = { ...data.items[idx], name: trimmed };
    writeCatalog(data);
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    if (!id) {
      return NextResponse.json(
        { ok: false, errorKey: "apiErrCatalogMissingId", error: "Missing id" },
        { status: 400 }
      );
    }
    const next = data.items.filter((i) => i.id !== id);
    if (next.length === data.items.length) {
      return NextResponse.json(
        { ok: false, errorKey: "apiErrCatalogTagMissing", error: "Tag not found" },
        { status: 404 }
      );
    }
    writeCatalog({ items: next });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json(
    { ok: false, errorKey: "apiErrUnknownAction", error: "Unknown action" },
    { status: 400 }
  );
}
