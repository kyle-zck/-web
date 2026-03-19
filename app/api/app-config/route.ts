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

