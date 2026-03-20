import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { requireAdminSession } from "@/lib/admin/auth";
import type { AppConfig } from "@/app/api/app-config/route";

const CONFIG_PATH = path.join(process.cwd(), "data", "app-config.json");

export async function GET() {
  const unauth = requireAdminSession();
  if (unauth) return unauth;
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const json = JSON.parse(raw) as AppConfig;
    return NextResponse.json({ ok: true, config: json });
  } catch {
    return NextResponse.json({ ok: true, config: { brandName: "ReelShorts", subscriptionPlans: [] } });
  }
}

async function saveConfig(body: Partial<AppConfig>) {
  const dir = path.dirname(CONFIG_PATH);
  await fs.mkdir(dir, { recursive: true });
  let current: AppConfig = { brandName: "ReelShorts", subscriptionPlans: [] };
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    current = { ...current, ...JSON.parse(raw) };
  } catch {
    // use defaults
  }
  const next = { ...current, ...body };
  await fs.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), "utf8");
  return next;
}

export async function POST(req: Request) {
  const unauth = requireAdminSession();
  if (unauth) return unauth;
  const body = (await req.json()) as Partial<AppConfig>;
  const next = await saveConfig(body);
  return NextResponse.json({ ok: true, config: next });
}

export async function PUT(req: Request) {
  const unauth = requireAdminSession();
  if (unauth) return unauth;
  const body = (await req.json()) as Partial<AppConfig>;
  const next = await saveConfig(body);
  return NextResponse.json({ ok: true, config: next });
}
