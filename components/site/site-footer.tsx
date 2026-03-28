"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AppConfig } from "@/lib/app-config/types";

export function SiteFooter() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [brand, setBrand] = useState("");
  const [legal, setLegal] = useState<{ terms?: string; privacy?: string }>({});

  useEffect(() => {
    fetch("/api/app-config")
      .then((r) => r.json())
      .then((c: AppConfig) => {
        setBrand(c.brandName ?? "");
        setLegal({
          terms: c.legal?.termsUrl?.trim(),
          privacy: c.legal?.privacyUrl?.trim()
        });
      })
      .catch(() => {});
  }, []);

  if (pathname.startsWith("/admin")) return null;

  const year = new Date().getFullYear();
  const displayBrand = brand || "ReelShorts";

  return (
    <footer className="mt-auto border-t border-zinc-800/50 bg-black py-6">
      <div className="page-gutter-x mx-auto flex max-w-[1400px] flex-col items-center justify-between gap-4 text-xs text-zinc-300 sm:flex-row">
        <p>
          {t("footer.rights", {
            year,
            brand: displayBrand
          })}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {legal.terms ? (
            <Link
              href={legal.terms}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-300 underline-offset-4 hover:text-brand hover:underline"
            >
              {t("footer.terms")}
            </Link>
          ) : null}
          {legal.privacy ? (
            <Link
              href={legal.privacy}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-300 underline-offset-4 hover:text-brand hover:underline"
            >
              {t("footer.privacy")}
            </Link>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
