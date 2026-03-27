import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeSecretKey(): string {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? "";
}

export function getStripeWebhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
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
  label?: string;
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
    const byId = normalizeStripePriceId(parsed[String(plan.id ?? "")]);
    if (byId) return byId;
    const byLabel = normalizeStripePriceId(parsed[String(plan.label ?? "")]);
    if (byLabel) return byLabel;
  } catch {
    return "";
  }
  return "";
}
