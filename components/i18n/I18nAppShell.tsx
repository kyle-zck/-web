"use client";

import type React from "react";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import { TopNavV2 } from "@/components/app/top-nav-v2";

export function I18nAppShell({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <TopNavV2 />
      <div className="flex-1">{children}</div>
    </I18nProvider>
  );
}

