"use client";

import type React from "react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { TopNavV2 } from "@/components/app/top-nav-v2";
import { SiteFooter } from "@/components/site/site-footer";
import { SupabaseProvider } from "@/components/supabase/SupabaseProvider";

export default function I18nAppShell({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <SupabaseProvider>
        <div className="flex min-h-0 flex-1 flex-col">
          <TopNavV2 />
          <div
            id="main-content"
            tabIndex={-1}
            className="flex min-h-0 flex-1 flex-col scroll-mt-[72px] outline-none focus:outline-none"
          >
            {children}
          </div>
          <SiteFooter />
        </div>
      </SupabaseProvider>
    </I18nProvider>
  );
}

