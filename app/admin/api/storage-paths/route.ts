import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const DATA_PATH = path.join(process.cwd(), "data", "storage-paths.json");

function readPaths() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { paths: [] };
  }
}

export async function GET() {
  const data = readPaths();
  return NextResponse.json({ ok: true, ...data });
}

export async function PUT(req: Request) {
  const { paths } = await req.json();
  if (!Array.isArray(paths)) {
    return NextResponse.json({ ok: false, error: "Invalid data" }, { status: 400 });
  }
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ paths }, null, 2), "utf-8");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
