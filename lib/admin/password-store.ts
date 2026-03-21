import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import type { Pool } from "pg";
import { getAdminPgPool } from "./admin-pg";

const FILE = path.join(process.cwd(), "data", "admin-password.json");

async function ensureTable(conn: Pool) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS admin_credentials (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      password_hash TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    );
  `);
}

export async function getStoredPasswordHash(): Promise<string | null> {
  const conn = getAdminPgPool();
  if (conn) {
    await ensureTable(conn);
    const { rows } = await conn.query(
      "SELECT password_hash FROM admin_credentials WHERE id = 1"
    );
    return (rows[0] as { password_hash?: string } | undefined)?.password_hash ?? null;
  }
  try {
    const raw = fs.readFileSync(FILE, "utf-8");
    const j = JSON.parse(raw) as { hash?: string };
    return j.hash ?? null;
  } catch {
    return null;
  }
}

export async function setStoredPasswordHash(hash: string): Promise<void> {
  const conn = getAdminPgPool();
  const now = Date.now();
  if (conn) {
    await ensureTable(conn);
    await conn.query(
      `INSERT INTO admin_credentials (id, password_hash, updated_at)
       VALUES (1, $1, $2)
       ON CONFLICT (id) DO UPDATE SET password_hash = $1, updated_at = $2`,
      [hash, now]
    );
    return;
  }
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify({ hash, updatedAt: now }, null, 2), "utf-8");
}

/** 校验登录密码：已存 hash 用 bcrypt；否则与 ADMIN_KEY 明文比对（首次部署） */
export async function verifyAdminPassword(plain: string): Promise<boolean> {
  const stored = await getStoredPasswordHash();
  if (stored) {
    return bcrypt.compareSync(plain, stored);
  }
  const envKey = process.env.ADMIN_KEY ?? "admin";
  return plain === envKey;
}

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, 10);
}
