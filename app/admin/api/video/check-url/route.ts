import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";

type CheckItem = {
  kind: "cover" | "videoUrl" | "videoPlaybackUrl";
  url: string;
};

function resolveUrl(input: string, base: string): string | null {
  const raw = (input || "").trim();
  if (!raw) return null;
  if (/^(data:|blob:|file:)/i.test(raw)) return null;
  try {
    const u = new URL(raw, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

async function checkOne(url: string, timeoutMs = 8000): Promise<{ ok: boolean; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const head = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal
    });
    if (head.status === 405) {
      const get = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal
      });
      return { ok: get.ok, status: get.status };
    }
    return { ok: head.ok, status: head.status };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(req: Request) {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const body = (await req.json().catch(() => ({}))) as {
    items?: CheckItem[];
  };
  const items = Array.isArray(body.items) ? body.items.slice(0, 10) : [];
  const base = new URL(req.url).origin;

  const results = await Promise.all(
    items.map(async (item) => {
      const resolved = resolveUrl(item.url, base);
      if (!resolved) {
        return {
          kind: item.kind,
          url: item.url,
          resolvedUrl: null,
          ok: false,
          status: 0
        };
      }
      const check = await checkOne(resolved);
      return {
        kind: item.kind,
        url: item.url,
        resolvedUrl: resolved,
        ok: check.ok,
        status: check.status
      };
    })
  );

  return NextResponse.json({ ok: true, results });
}

