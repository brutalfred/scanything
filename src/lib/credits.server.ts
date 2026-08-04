// Server-only credit bridge: debits credits before an AI call and refunds on failure.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { CREDIT_COSTS, INSUFFICIENT_CREDITS, type CreditReason } from "./credits";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

export function createUserClient(token: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase server environment variables");

  return createClient<Database>(url, key, {
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isNewSupabaseApiKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}


export async function hasActiveSubscription(
  userId: string,
  environment?: "sandbox" | "live",
): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let query = supabaseAdmin
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId);

  if (environment) query = query.eq("environment", environment);

  const { data: row } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return false;

  const now = Date.now();
  const periodEnd = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
  const active = ["active", "trialing"].includes(row.status) && (periodEnd === null || periodEnd > now);
  const grace = row.status === "canceled" && periodEnd !== null && periodEnd > now;
  return active || grace;
}

/**
 * Runs `fn` behind a credit debit.
 *
 * Requires a verified user id (from `requireSupabaseAuth`). Active Scanything
 * Pro subscribers skip credit consumption for the covered environment.
 */
export async function withCredits<T>(
  reason: CreditReason,
  userId: string,
  fn: () => Promise<T>,
  environment?: "sandbox" | "live",
): Promise<T> {
  // The caller must pass the identity verified by `requireSupabaseAuth`.
  // Never derive it from an unverified bearer token here.
  if (!userId) throw new Error("Unauthorized");

  const amount = CREDIT_COSTS[reason];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (await hasActiveSubscription(userId, environment)) {
    return await fn();
  }

  // One free photo/resale scan per day for signed-in users.
  if (reason === "photo_scan") {
    const { data: claimed, error: freeError } = await supabaseAdmin.rpc(
      "claim_free_scan_for",
      { _user_id: userId },
    );
    if (!freeError && claimed === true) {
      try {
        return await fn();
      } catch (err) {
        // Failed AI calls don't burn the free scan.
        await supabaseAdmin.rpc("release_free_scan_for", { _user_id: userId });
        throw err;
      }
    }
  }

  const { error } = await supabaseAdmin.rpc("spend_credits_for", {
    _user_id: userId,
    _amount: amount,
    _reason: reason,
    _metadata: {},
  });

  if (error) {
    if (error.message.includes(INSUFFICIENT_CREDITS)) {
      throw new Error(INSUFFICIENT_CREDITS);
    }
    throw new Error(`Credit check failed: ${error.message}`);
  }

  try {
    return await fn();
  } catch (err) {
    // Failed AI calls are free — refund through the backend-only refund path.
    await supabaseAdmin.rpc("refund_credits_for", {
      _user_id: userId,
      _amount: amount,
      _reason: `refund:${reason}`,
    });
    throw err;
  }
}


