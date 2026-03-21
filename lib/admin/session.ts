import { SignJWT, jwtVerify } from "jose";

/** 与 middleware / API 共用的 Cookie 名 */
export const SESSION_COOKIE = "admin_session";

/** 会话有效期：10 分钟（每次请求在 middleware 中滚动续期） */
export const SESSION_TTL_MS = 10 * 60 * 1000;

function jwtSecretKey(): Uint8Array {
  const raw =
    process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_KEY ?? "development-only";
  const enc = new TextEncoder().encode(raw);
  const out = new Uint8Array(32);
  if (enc.length >= 32) {
    out.set(enc.slice(0, 32));
  } else {
    out.set(enc);
    for (let i = enc.length; i < 32; i++) {
      out[i] = enc[i % enc.length] ^ (i * 7);
    }
  }
  return out;
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(new Date(Date.now() + SESSION_TTL_MS))
    .sign(jwtSecretKey());
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, jwtSecretKey());
    return true;
  } catch {
    return false;
  }
}

/** 不设 maxAge = 浏览器会话 Cookie，关闭浏览器后清除（与 JWT 10 分钟内过期配合） */
export function sessionCookieOptions(): {
  httpOnly: boolean;
  sameSite: "lax";
  path: string;
  secure: boolean;
} {
  const secure =
    process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
  return {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure
  };
}
