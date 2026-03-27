import { NextRequest, NextResponse } from "next/server";
import { getAppConfigOrDefault } from "@/lib/app-config";
import { getOrCreateUid } from "@/lib/user-repo";
import { deriveStripePriceId, getStripeClient } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json(
      { ok: false, error: "stripe_not_configured" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const clientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
  const planIdOrLabel = typeof body?.planId === "string" ? body.planId.trim() : "";
  if (!clientId || !planIdOrLabel) {
    return NextResponse.json(
      { ok: false, error: "clientId and planId required" },
      { status: 400 }
    );
  }

  const cfg = await getAppConfigOrDefault();
  const plan =
    cfg.subscriptionPlans.find((p) => p.id === planIdOrLabel) ??
    cfg.subscriptionPlans.find((p) => p.label === planIdOrLabel);
  if (!plan) {
    return NextResponse.json({ ok: false, error: "plan_not_found" }, { status: 404 });
  }

  const priceId = deriveStripePriceId({
    id: plan.id,
    label: plan.label,
    paymentUrl: (plan as { paymentUrl?: string }).paymentUrl,
    stripePriceId: (plan as { stripePriceId?: string }).stripePriceId
  });
  if (!priceId) {
    return NextResponse.json(
      { ok: false, error: "stripe_price_missing" },
      { status: 400 }
    );
  }

  const user = await getOrCreateUid(clientId);
  const origin =
    req.headers.get("origin")?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "http://localhost:3000";
  const successUrl = `${origin}/store?pay=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/store?pay=cancel`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: user.uid,
    metadata: {
      uid: user.uid,
      clientId,
      tier: plan.label,
      planId: plan.id,
      rechargeDays: String(Math.max(0, Math.floor(Number(plan.durationDays) || 0)))
    },
    subscription_data: {
      metadata: {
        uid: user.uid,
        clientId,
        tier: plan.label,
        planId: plan.id,
        rechargeDays: String(Math.max(0, Math.floor(Number(plan.durationDays) || 0)))
      }
    }
  });

  return NextResponse.json({ ok: true, url: session.url, sessionId: session.id });
}
