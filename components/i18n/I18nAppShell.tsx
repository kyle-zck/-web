"use client";

import type React from "react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { TopNavV2 } from "@/components/app/top-nav-v2";

export default function I18nAppShell({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <div className="flex min-h-0 flex-1 flex-col">
        <TopNavV2 />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </I18nProvider>
  );
}

