"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;
let loadPromise: Promise<SupabaseClient | null> | null = null;

/**
 * 异步创建浏览器端 Supabase 客户端。
 * 使用动态 import('@supabase/ssr')，避免把整包 @supabase/supabase-js（约数十 KB）
 * 打进首屏同步解析，减轻 Lighthouse「未使用 JavaScript」与主线程压力。
 */
export async function getSupabaseBrowserClientAsync(): Promise<SupabaseClient | null> {
  if (browserClient) return browserClient;
  if (loadPromise) return loadPromise;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    loadPromise = Promise.resolve(null);
    return loadPromise;
  }

  loadPromise = import("@supabase/ssr").then(({ createBrowserClient }) => {
    browserClient = createBrowserClient(url, anon);
    return browserClient;
  });
  return loadPromise;
}

/**
 * 同步获取已创建的客户端；在首次 `getSupabaseBrowserClientAsync` 完成前为 `null`。
 */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  return browserClient;
}
