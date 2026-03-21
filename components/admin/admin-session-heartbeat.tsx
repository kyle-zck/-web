"use client";

import { useCallback, useEffect, useRef } from "react";

/** 无页面跳转时仍定期续期 JWT（10 分钟滚动），并响应点击/按键 */
export function AdminSessionHeartbeat() {
  const ping = useCallback(() => {
    fetch("/admin/api/session/refresh", {
      method: "POST",
      credentials: "include"
    }).catch(() => {});
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onActivity = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      ping();
    }, 3000);
  }, [ping]);

  useEffect(() => {
    const id = setInterval(ping, 2 * 60 * 1000);
    window.addEventListener("click", onActivity);
    window.addEventListener("keydown", onActivity);
    return () => {
      clearInterval(id);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      window.removeEventListener("click", onActivity);
      window.removeEventListener("keydown", onActivity);
    };
  }, [ping, onActivity]);

  return null;
}
