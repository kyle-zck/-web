import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const body = (await req.json()) as { key?: string };
  const key = body.key ?? "";

  const expected = process.env.ADMIN_KEY ?? "admin";
  if (!key || key !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  cookies().set("admin_session", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false
  });

  return NextResponse.json({ ok: true });
}

