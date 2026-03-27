/** 后台 /admin/api 请求需携带 Cookie；响应可能为 HTML 错误页，需安全解析 JSON */
export async function fetchAdminJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 10000
): Promise<{ res: Response; json: T | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1000, timeoutMs));
  const onAbort = () => ctrl.abort();
  init?.signal?.addEventListener("abort", onAbort);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      credentials: "include",
      cache: "no-store",
      signal: ctrl.signal
    });
  } finally {
    clearTimeout(timer);
    init?.signal?.removeEventListener("abort", onAbort);
  }
  const text = await res.text();
  let json: T | null = null;
  if (text) {
    try {
      json = JSON.parse(text) as T;
    } catch {
      json = null;
    }
  }
  return { res, json };
}
