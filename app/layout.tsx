import type { Metadata } from "next";
import "./globals.css";
import { TopNavV2 } from "@/components/app/top-nav-v2";
import { I18nProvider } from "@/components/i18n/I18nProvider";

export const metadata: Metadata = {
  title: "ReelShort 风格短剧平台",
  description: "移动优先的海外短剧在线观看平台"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="min-h-screen bg-black text-white antialiased">
        <div className="app-shell mx-auto flex min-h-screen flex-col bg-black">
          <I18nProvider>
            <TopNavV2 />
            <div className="flex-1">{children}</div>
          </I18nProvider>
        </div>
      </body>
    </html>
  );
}
