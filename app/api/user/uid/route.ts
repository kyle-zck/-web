import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUid, getUidByClientId } from "@/lib/user-repo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ ok: false, error: "clientId required" }, { status: 400 });
  }

  const create = req.nextUrl.searchParams.get("create") !== "false";
  if (create) {
    const user = await getOrCreateUid(clientId);
    return NextResponse.json({ ok: true, uid: user.uid, clientId: user.clientId });
  }

  const uid = await getUidByClientId(clientId);
  return NextResponse.json({ ok: true, uid, clientId });
}
