/** 后台 /admin/api 请求需携带 Cookie；响应可能为 HTML 错误页，需安全解析 JSON */
export async function fetchAdminJson<T>(
  url: string,
  init?: RequestInit
): Promise<{ res: Response; json: T | null }> {
  const res = await fetch(url, { ...init, credentials: "include" });
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
