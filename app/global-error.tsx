"use client";

/**
 * 根布局级错误边界（须自带 html/body）。
 * 根布局失败时不要依赖 Tailwind（可能未注入），故使用内联样式。
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#000",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>应用加载失败</h1>
          <p style={{ fontSize: 14, color: "#a1a1aa", marginBottom: 20 }}>
            {error?.message || "请检查网络与配置后重试。"}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              background: "#E50914",
              color: "#fff",
              border: "none",
              borderRadius: 9999,
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
