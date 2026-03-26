import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { getAppConfigOrDefault, saveAppConfig } from "@/lib/app-config/service";
import type { AppConfig } from "@/lib/app-config/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  try {
    const config = await getAppConfigOrDefault();
    return NextResponse.json({ ok: true, config });
  } catch (e) {
    console.error("[admin app-config] GET", e);
    return NextResponse.json({ ok: false, errorKey: "apiErrLoadFailed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  try {
    const body = (await req.json()) as Partial<AppConfig>;
    const next = await saveAppConfig(body);
    return NextResponse.json({ ok: true, config: next });
  } catch (e) {
    console.error("[admin app-config] POST", e);
    return NextResponse.json({ ok: false, errorKey: "apiErrSaveFailed" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  try {
    const body = (await req.json()) as Partial<AppConfig>;
    const next = await saveAppConfig(body);
    return NextResponse.json({ ok: true, config: next });
  } catch (e) {
    console.error("[admin app-config] PUT", e);
    return NextResponse.json({ ok: false, errorKey: "apiErrSaveFailed" }, { status: 500 });
  }
}
