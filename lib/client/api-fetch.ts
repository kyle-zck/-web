import type { TFunction } from "i18next";

/** 拉取 JSON（GET），超时 abort；用于 app-config 等轻量接口 */
export async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs = 8000,
  signal?: AbortSignal
): Promise<T> {
  const ctrl = new AbortController();
  const timer = typeof window !== "undefined" ? window.setTimeout(() => ctrl.abort(), timeoutMs) : 0;
  const onAbort = () => ctrl.abort();
  signal?.addEventListener("abort", onAbort);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      cache: "no-store"
    });
    return (await res.json()) as T;
  } finally {
    if (typeof window !== "undefined" && timer) window.clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export const STRIPE_CHECKOUT_TIMEOUT_MS = 28_000;

export type StripeCheckoutPostResult =
  | { ok: true; url: string }
  | { ok: false; error?: string; aborted?: boolean };

export async function postStripeCheckoutSession(
  body: { clientId: string; planId: string },
  opts?: { timeoutMs?: number; signal?: AbortSignal }
): Promise<StripeCheckoutPostResult> {
  const timeoutMs = opts?.timeoutMs ?? STRIPE_CHECKOUT_TIMEOUT_MS;
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  const onParentAbort = () => ctrl.abort();
  opts?.signal?.addEventListener("abort", onParentAbort);
  try {
    const res = await fetch("/api/payments/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: "no-store"
    });
    const json = (await res.json()) as { ok?: boolean; url?: string; error?: string };
    if (!res.ok || !json?.ok || !json.url) {
      return { ok: false, error: json?.error };
    }
    return { ok: true, url: json.url };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      return { ok: false, aborted: true };
    }
    return { ok: false };
  } finally {
    window.clearTimeout(timer);
    opts?.signal?.removeEventListener("abort", onParentAbort);
  }
}

export function mapCheckoutErrorToMessage(error: string | undefined, t: TFunction): string {
  switch ((error ?? "").trim()) {
    case "stripe_not_configured":
      return t("store.errStripeNotConfigured", "Payment not configured: STRIPE_SECRET_KEY is missing.");
    case "stripe_price_missing":
      return t(
        "store.errStripePriceMissing",
        "Plan is not linked to a Stripe Price. Please configure stripePriceId or STRIPE_PRICE_MAP_JSON in admin."
      );
    case "stripe_price_invalid":
      return t("store.errStripePriceInvalid", "Stripe Price is invalid or does not exist. Please check price_xxx.");
    case "stripe_secret_key_invalid":
      return t("store.errStripeSecretInvalid", "Stripe Secret Key is invalid. Please check production environment keys.");
    case "stripe_checkout_failed":
      return t(
        "store.errStripeCheckoutFailed",
        "Failed to create Stripe checkout session. Please try again later or contact administrator."
      );
    case "plan_not_found":
      return t("store.errPlanNotFound", "Plan not found. Please refresh the page and try again.");
    case "clientId_and_planId_required":
      return t("store.errMissingParams", "Payment parameters missing. Please select a plan again.");
    default:
      return t("store.paymentNotReady", "Payment is temporarily unavailable. Please try again.");
  }
}

export function checkoutResultToUserMessage(
  result: StripeCheckoutPostResult,
  t: TFunction
): string {
  if (result.ok) return "";
  if (result.aborted) {
    return t(
      "store.checkoutTimeout",
      "Payment request timed out. Check your connection and try again."
    );
  }
  return mapCheckoutErrorToMessage(result.error, t);
}
