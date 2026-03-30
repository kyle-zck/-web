"use client";

/**
 * Root layout-level error boundary (must provide its own html/body).
 * Avoids Tailwind since it may not be injected when the root layout fails.
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
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
          <h1 style={{ fontSize: 20, marginBottom: 12 }}>App failed to load</h1>
          <p style={{ fontSize: 14, color: "#a1a1aa", marginBottom: 20 }}>
            {error?.message || "Please check your network and configuration, then try again."}
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
            Retry
          </button>
        </div>
      </body>
    </html>
  );
}
