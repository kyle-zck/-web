import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 服务端 Supabase（需 Service Role，仅用于 API Route / Server Action，勿暴露给浏览器）。
 * 未配置环境变量时返回 null，便于渐进接入 Auth / Storage。
 */
export function createSupabaseServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
