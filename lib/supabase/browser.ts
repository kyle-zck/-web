"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 浏览器端 Supabase（Anon Key），供后续接入 Supabase Auth 等使用。
 */
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return null;
  browserClient = createClient(url, anon);
  return browserClient;
}
