import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import {
  getAdminAssetConfigOrDefault,
  replaceAccessList
} from "@/lib/admin/asset-config";
import type { AccessListConfig } from "@/lib/admin/asset-config";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  const cfg = await getAdminAssetConfigOrDefault();
  return NextResponse.json({ ok: true, accessList: cfg.accessList });
}

export async function PUT(req: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;
  const body = (await req.json().catch(() => ({}))) as Partial<AccessListConfig>;
  const whitelistClientIds = Array.isArray(body.whitelistClientIds)
    ? body.whitelistClientIds.filter(
        (s): s is string => typeof s === "string" && s.trim().length > 0
      )
    : [];
  const blacklistClientIds = Array.isArray(body.blacklistClientIds)
    ? body.blacklistClientIds.filter(
        (s): s is string => typeof s === "string" && s.trim().length > 0
      )
    : [];
  const next = await replaceAccessList({
    whitelistClientIds,
    blacklistClientIds,
    updatedAt: body.updatedAt ?? new Date().toISOString()
  });
  return NextResponse.json({ ok: true, accessList: next.accessList });
}

