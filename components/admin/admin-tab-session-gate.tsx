"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ADMIN_TAB_SESSION_KEY } from "@/lib/admin/tab-session";

/**
 * 无本标签登录标记时视为「未在本标签登录」，清除服务端 Cookie 并跳转登录。
 * 关闭标签后 sessionStorage 消失，再开同址也需重新登录。
 */
export function AdminTabSessionGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      if (!sessionStorage.getItem(ADMIN_TAB_SESSION_KEY)) {
        fetch("/admin/api/logout", { method: "POST", credentials: "include" })
          .catch(() => {})
          .finally(() => {
            window.location.replace("/admin/login");
          });
        return;
      }
      setReady(true);
    } catch {
      window.location.replace("/admin/login");
    }
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-sm text-zinc-400">
        {t("admin.sessionChecking")}
      </div>
    );
  }

  return <>{children}</>;
}
