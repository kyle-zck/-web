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
      return t("store.errStripeNotConfigured", "支付未配置：缺少 STRIPE_SECRET_KEY。");
    case "stripe_price_missing":
      return t(
        "store.errStripePriceMissing",
        "套餐未绑定 Stripe Price。请在后台填写 stripePriceId 或 STRIPE_PRICE_MAP_JSON。"
      );
    case "stripe_price_invalid":
      return t("store.errStripePriceInvalid", "Stripe Price 无效或不存在，请检查 price_xxx。");
    case "stripe_secret_key_invalid":
      return t("store.errStripeSecretInvalid", "Stripe Secret Key 无效，请检查生产环境密钥。");
    case "stripe_checkout_failed":
      return t(
        "store.errStripeCheckoutFailed",
        "Stripe 创建结账会话失败，请稍后重试或联系管理员查看日志。"
      );
    case "plan_not_found":
      return t("store.errPlanNotFound", "套餐不存在，请刷新页面后重试。");
    case "clientId_and_planId_required":
      return t("store.errMissingParams", "支付参数缺失，请重新选择套餐。");
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
