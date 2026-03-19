import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), "data", "app-config.json");

const DEFAULT_CONFIG = {
  brandName: "ReelShorts"
};

export async function GET() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const json = JSON.parse(raw) as typeof DEFAULT_CONFIG;
    return NextResponse.json(json);
  } catch {
    return NextResponse.json(DEFAULT_CONFIG);
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    brandName?: string;
  };

  const next = {
    ...DEFAULT_CONFIG,
    ...body,
    brandName: body.brandName?.trim() || DEFAULT_CONFIG.brandName
  };

  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), "utf8");

  return NextResponse.json({ ok: true, config: next });
}

