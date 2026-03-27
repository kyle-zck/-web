import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin/auth";
import { getAppConfigOrDefault } from "@/lib/app-config";
import { deriveStripePriceId, getStripeSecretKey, getStripeWebhookSecret } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

function rawEnv(name: string): string {
  return process.env[name] ?? "";
}

function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return `${secret.slice(0, 2)}***`;
  return `${secret.slice(0, 6)}...${secret.slice(-4)}`;
}

function parsePriceMap() {
  const raw = rawEnv("STRIPE_PRICE_MAP_JSON");
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false as const, reason: "empty", keys: [] as string[] };
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, string>;
    return {
      ok: true as const,
      keys: Object.keys(parsed),
      parsed
    };
  } catch {
    return { ok: false as const, reason: "invalid_json", keys: [] as string[] };
  }
}

export async function GET() {
  const unauth = await requireAdminSession();
  if (unauth) return unauth;

  const secretRaw = rawEnv("STRIPE_SECRET_KEY");
  const webhookRaw = rawEnv("STRIPE_WEBHOOK_SECRET");
  const secretClean = getStripeSecretKey();
  const webhookClean = getStripeWebhookSecret();
  const map = parsePriceMap();
  const cfg = await getAppConfigOrDefault();

  const planChecks = (cfg.subscriptionPlans ?? []).map((plan) => {
    const resolved = deriveStripePriceId({
      id: plan.id,
      stripePriceId: (plan as { stripePriceId?: string }).stripePriceId,
      paymentUrl: (plan as { paymentUrl?: string }).paymentUrl
    });
    return {
      id: plan.id,
      label: plan.label,
      hasStripePriceIdField: Boolean((plan as { stripePriceId?: string }).stripePriceId?.trim()),
      resolvedPriceId: resolved || null,
      resolved: Boolean(resolved)
    };
  });

  return NextResponse.json({
    ok: true,
    env: {
      nodeEnv: process.env.NODE_ENV ?? "",
      vercelEnv: process.env.VERCEL_ENV ?? "",
      hasStripeSecretKey: Boolean(secretClean),
      stripeSecretKeyPrefix: secretClean.slice(0, 8),
      stripeSecretKeyMasked: maskSecret(secretClean),
      stripeSecretKeyLooksValid: secretClean.startsWith("sk_"),
      stripeSecretKeyHadQuotes: /^['"].*['"]$/.test(secretRaw.trim()),
      stripeSecretKeyHadNewline: /\r|\n/.test(secretRaw),
      hasWebhookSecret: Boolean(webhookClean),
      webhookSecretPrefix: webhookClean.slice(0, 8),
      webhookSecretLooksValid: webhookClean.startsWith("whsec_"),
      webhookSecretHadQuotes: /^['"].*['"]$/.test(webhookRaw.trim()),
      webhookSecretHadNewline: /\r|\n/.test(webhookRaw)
    },
    priceMap: {
      configured: map.ok,
      reason: map.ok ? "ok" : map.reason,
      keyCount: map.keys.length,
      keys: map.keys
    },
    plans: {
      count: planChecks.length,
      items: planChecks
    }
  });
}

