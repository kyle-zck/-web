import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { validateNewPassword } from "@/lib/admin/password-policy";
import { hashPassword, setStoredPasswordHash, verifyAdminPassword } from "@/lib/admin/password-store";

export async function POST(req: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  try {
    const body = (await req.json()) as {
      oldPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    const oldPassword = body.oldPassword ?? "";
    const newPassword = body.newPassword ?? "";
    const confirmPassword = body.confirmPassword ?? "";

    if (!oldPassword || !(await verifyAdminPassword(oldPassword))) {
      return NextResponse.json(
        { ok: false, errorKey: "wrongOldPassword" },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { ok: false, errorKey: "passwordConfirmMismatch" },
        { status: 400 }
      );
    }

    const policyErr = validateNewPassword(newPassword);
    if (policyErr) {
      return NextResponse.json({ ok: false, errorKey: policyErr }, { status: 400 });
    }

    if (newPassword === oldPassword) {
      return NextResponse.json(
        { ok: false, errorKey: "passwordSameAsOld" },
        { status: 400 }
      );
    }

    await setStoredPasswordHash(hashPassword(newPassword));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, errorKey: "passwordSaveFailed" },
      { status: 500 }
    );
  }
}
