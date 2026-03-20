import type { Metadata, Viewport } from "next";
import "./globals.css";
import I18nAppShell from "@/components/i18n/I18nAppShell";

export const metadata: Metadata = {
  title: "ReelShort 风格短剧平台",
  description: "移动优先的海外短剧在线观看平台"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-black text-white antialiased safe-area">
        <div className="app-shell mx-auto flex min-h-screen flex-col bg-black">
          <I18nAppShell>{children}</I18nAppShell>
        </div>
      </body>
    </html>
  );
}
