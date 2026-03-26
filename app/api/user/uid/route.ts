import { NextRequest, NextResponse } from "next/server";
import { getOrCreateUid, getUidByClientId, touchGuestLogin } from "@/lib/user-repo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get("clientId");
  if (!clientId || typeof clientId !== "string") {
    return NextResponse.json({ ok: false, error: "clientId required" }, { status: 400 });
  }

  const create = req.nextUrl.searchParams.get("create") !== "false";
  if (create) {
    const user = await getOrCreateUid(clientId);
    // 记录 guest 登录信息（last_login / ip / device）
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "";
    const ua = req.headers.get("user-agent") ?? "";
    await touchGuestLogin({ clientId, ip, userAgent: ua });
    return NextResponse.json({ ok: true, uid: user.uid, clientId: user.clientId });
  }

  const uid = await getUidByClientId(clientId);
  return NextResponse.json({ ok: true, uid, clientId });
}
