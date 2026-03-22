import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { readCatalog, writeCatalog } from "@/lib/drama-tag-catalog/store";

export const runtime = "nodejs";

function jsonError(message: string, status: number, errorKey?: string) {
  return NextResponse.json(
    { ok: false, error: message, ...(errorKey ? { errorKey } : {}) },
    { status }
  );
}

export async function GET() {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  try {
    const data = await readCatalog();
    return NextResponse.json({ ok: true, items: data.items });
  } catch (e) {
    console.error("[drama-tag-catalog] GET:", e);
    return jsonError("Failed to load catalog", 500, "apiErrCatalogLoadFailed");
  }
}

export async function POST(req: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  let body: { action?: string; name?: string; id?: string };
  try {
    body = (await req.json()) as { action?: string; name?: string; id?: string };
  } catch {
    return jsonError("Invalid JSON body", 400, "apiErrInvalidBody");
  }

  const { action, name, id } = body;

  try {
    const data = await readCatalog();

    if (action === "add") {
      const trimmed = (name ?? "").trim();
      if (!trimmed) {
        return NextResponse.json(
          {
            ok: false,
            errorKey: "apiErrCatalogTagNameEmpty",
            error: "Tag name cannot be empty"
          },
          { status: 400 }
        );
      }
      if (data.items.some((i) => i.name === trimmed)) {
        return NextResponse.json(
          {
            ok: false,
            errorKey: "apiErrCatalogTagDuplicate",
            error: "This tag already exists"
          },
          { status: 400 }
        );
      }
      const newId = `dt-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      data.items.push({ id: newId, name: trimmed });
      await writeCatalog(data);
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
          {
            ok: false,
            errorKey: "apiErrCatalogTagNameEmpty",
            error: "Tag name cannot be empty"
          },
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
          {
            ok: false,
            errorKey: "apiErrCatalogNameDuplicate",
            error: "This name is already in use"
          },
          { status: 400 }
        );
      }
      data.items[idx] = { ...data.items[idx], name: trimmed };
      await writeCatalog(data);
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
      await writeCatalog({ items: next });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, errorKey: "apiErrUnknownAction", error: "Unknown action" },
      { status: 400 }
    );
  } catch (e) {
    console.error("[drama-tag-catalog] POST:", e);
    return jsonError(
      e instanceof Error ? e.message : "Failed to save catalog",
      503,
      "apiErrCatalogWriteFailed"
    );
  }
}
