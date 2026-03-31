import type { SubscriptionPlan } from "@/constants/mock-data";

export type AppConfigClientPayload = {
  subscriptionPlans?: SubscriptionPlan[];
  store?: {
    title?: string;
    subtitle?: string;
    tips?: string[];
  };
};

let memory: AppConfigClientPayload | null = null;
let inflight: Promise<AppConfigClientPayload> | null = null;

export function peekAppConfigCache(): AppConfigClientPayload | null {
  return memory;
}

/**
 * 拉取 /api/app-config，内存单例 + 并发去重。
 * 使用 cache: default 尊重服务端 Cache-Control，减轻重复请求。
 */
export function setAppConfigMemory(json: AppConfigClientPayload): void {
  memory = json ?? {};
}

export function loadAppConfigClient(signal?: AbortSignal): Promise<AppConfigClientPayload> {
  if (memory) return Promise.resolve(memory);
  if (!inflight) {
    inflight = (async () => {
      const res = await fetch("/api/app-config", {
        signal,
        cache: "default"
      });
      if (!res.ok) throw new Error(`app-config ${res.status}`);
      const json = (await res.json()) as AppConfigClientPayload;
      memory = json ?? {};
      return memory;
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

/** 播放页空闲时预取，打开充值弹窗时可立即命中内存 */
export function prefetchAppConfig(): void {
  if (typeof window === "undefined" || memory) return;
  const run = () => {
    loadAppConfigClient().catch(() => {});
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 2000 });
  } else {
    globalThis.setTimeout(run, 400);
  }
}
