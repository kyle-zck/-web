import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import I18nAppShell from "@/components/i18n/I18nAppShell";
import { getCachedAppConfig } from "@/lib/app-config/service";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  minimumScale: 1,
  viewportFit: "cover"
};

export async function generateMetadata(): Promise<Metadata> {
  const cfg = await getCachedAppConfig();
  const title = (cfg.seo?.siteTitle?.trim() || cfg.brandName || "ReelShorts").trim();
  const description = (
    cfg.seo?.siteDescription ||
    "Mobile-first overseas short drama streaming platform"
  ).trim();
  const og = cfg.seo?.ogImageUrl?.trim();
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(og ? { images: [{ url: og }] } : {})
    }
  };
}

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const cfg = await getCachedAppConfig();
  const lang = cfg.seo?.defaultLocale === "en" ? "en" : "zh-CN";

  const skipToMain =
    lang === "en" ? "Skip to main content" : "跳转至正文内容";

  return (
    <html lang={lang} className={`dark ${inter.variable}`}>
      <body
        className={`${inter.className} min-h-screen bg-black text-white antialiased safe-area`}
      >
        <a href="#main-content" className="skip-link">
          {skipToMain}
        </a>
        <div className="app-shell mx-auto flex min-h-screen flex-col bg-black">
          <I18nAppShell>{children}</I18nAppShell>
        </div>
      </body>
    </html>
  );
}
