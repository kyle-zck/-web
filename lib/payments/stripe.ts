import Stripe from "stripe";

let stripeClient: Stripe | null = null;

function cleanEnvSecret(raw: string | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  // 容错：支持用户把 key 包在引号里粘贴到环境变量
  const unquoted =
    (v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith("'") && v.endsWith("'"))
      ? v.slice(1, -1).trim()
      : v;
  return unquoted.replace(/\r?\n/g, "").trim();
}

export function getStripeSecretKey(): string {
  return cleanEnvSecret(process.env.STRIPE_SECRET_KEY);
}

export function getStripeWebhookSecret(): string {
  return cleanEnvSecret(process.env.STRIPE_WEBHOOK_SECRET);
}

export function getStripeClient(): Stripe | null {
  if (stripeClient) return stripeClient;
  const key = getStripeSecretKey();
  if (!key) return null;
  stripeClient = new Stripe(key);
  return stripeClient;
}

export function normalizeStripePriceId(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s.startsWith("price_") ? s : "";
}

export function deriveStripePriceId(plan: {
  id?: string;
  paymentUrl?: string;
  stripePriceId?: string;
}): string {
  const byPlan = normalizeStripePriceId(plan.stripePriceId);
  if (byPlan) return byPlan;

  const byPaymentUrl = normalizeStripePriceId(plan.paymentUrl);
  if (byPaymentUrl) return byPaymentUrl;

  const mapRaw = process.env.STRIPE_PRICE_MAP_JSON?.trim();
  if (!mapRaw) return "";
  try {
    const parsed = JSON.parse(mapRaw) as Record<string, string>;
    const normalizeKey = (v: unknown) => String(v ?? "").trim().toLowerCase();
    const getByKey = (k: unknown) => {
      const key = normalizeKey(k);
      if (!key) return "";
      // 先精确，再大小写无关兜底
      const exact = normalizeStripePriceId(parsed[String(k ?? "")]);
      if (exact) return exact;
      const hit = Object.entries(parsed).find(([pk]) => normalizeKey(pk) === key)?.[1];
      return normalizeStripePriceId(hit);
    };

    const byId = getByKey(plan.id);
    if (byId) return byId;
  } catch {
    return "";
  }
  return "";
}
