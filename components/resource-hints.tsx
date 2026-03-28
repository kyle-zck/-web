/**
 * 首屏前尽早建立与第三方源的连接（Lighthouse「预连接 / 关键依赖链」）
 * 仅输出环境变量中已配置的 origin，最多 4 条。
 */
export function ResourceHints() {
  const origins = new Set<string>();

  const add = (url: string | undefined) => {
    if (!url) return;
    try {
      const u = new URL(url);
      if (u.protocol === "http:" || u.protocol === "https:") {
        origins.add(u.origin);
      }
    } catch {
      /* ignore */
    }
  };

  add(process.env.NEXT_PUBLIC_SUPABASE_URL);
  add(process.env.S3_PUBLIC_BASE_URL);
  add(process.env.NEXT_PUBLIC_SITE_URL);

  const list = Array.from(origins).slice(0, 4);

  return (
    <>
      {list.map((href) => (
        <link key={href} rel="preconnect" href={href} crossOrigin="anonymous" />
      ))}
    </>
  );
}
