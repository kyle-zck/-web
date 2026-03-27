import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
  addRechargeRecord,
  grantMembershipByUid,
  recordPaymentEventOnce
} from "@/lib/user-repo";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/payments/stripe";

export const dynamic = "force-dynamic";

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

export async function POST(req: Request) {
  const stripe = getStripeClient();
  const webhookSecret = getStripeWebhookSecret();
  if (!stripe || !webhookSecret) {
    return NextResponse.json(
      { ok: false, error: "stripe_webhook_not_configured" },
      { status: 500 }
    );
  }

  const sig = headers().get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ ok: false, error: "missing_signature" }, { status: 400 });
  }

  const raw = await req.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 400 });
  }

  if (event.type === "invoice.paid") {
    const eventId = String(event.id ?? "").trim();
    const invoice = event.data.object;
    const subscriptionId = String((invoice as any).subscription ?? "").trim();
    const sessionId = String((invoice as any).checkout_session ?? "").trim();
    const amountPaid = asNumber((invoice as any).amount_paid ?? (invoice as any).amount_due ?? 0, 0);
    const paidUsd = (amountPaid || 0) / 100;
    const paidDate = new Date().toISOString().slice(0, 10);

    if (!subscriptionId) {
      return NextResponse.json({ ok: true });
    }

    let subMeta: any = null;
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      subMeta = (sub as any)?.metadata ?? null;
    } catch {
      subMeta = null;
    }

    const uid = String(subMeta?.uid ?? "").trim();
    const tier = String(subMeta?.tier ?? "").trim();
    const rechargeDays = Math.max(0, Math.floor(asNumber(subMeta?.rechargeDays, 0)));

    if (uid && tier && paidUsd > 0) {
      const firstTime = await recordPaymentEventOnce({
        provider: "stripe",
        eventId,
        sessionId,
        uid
      });
      if (!firstTime) {
        return NextResponse.json({ ok: true });
      }

      await addRechargeRecord({
        uid,
        date: paidDate,
        price: paidUsd,
        tier,
        rechargeDays
      });
      await grantMembershipByUid({
        uid,
        planLabel: tier,
        remainingDays: rechargeDays
      });
    }
  }

  return NextResponse.json({ ok: true });
}
