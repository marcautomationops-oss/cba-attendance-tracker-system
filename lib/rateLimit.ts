import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

async function keyHash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Buffer.from(bytes).toString("hex");
}

export async function consumeDurableRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_key_hash: await keyHash(key),
    p_limit: limit,
    p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000))
  });
  if (error) throw new Error("Production rate limiting is unavailable. Apply the latest Supabase schema.");

  const result = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(result?.allowed),
    remaining: Math.max(0, Number(result?.remaining || 0)),
    retryAfterSeconds: Math.max(1, Number(result?.retry_after_seconds || 1))
  };
}

export async function clearDurableRateLimit(key: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("rate_limits").delete().eq("key_hash", await keyHash(key));
  if (error) throw new Error(error.message);
}
