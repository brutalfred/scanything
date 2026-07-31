// Server-only credit bridge: debits credits before an AI call and refunds on failure.
import { createClient } from "@supabase/supabase-js";
import { getRequestHeader } from "@tanstack/react-start/server";
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


/**
 * Runs `fn` behind a credit debit.
 *
 * Requires a verified user id (from `requireSupabaseAuth`). There is no
 * anonymous path: every AI call is authenticated and charged, and refunded
 * when the AI call fails.
 */

// Identity is never derived from an unverified bearer token in this module.
// Every caller must supply the user id verified by `requireSupabaseAuth`.


export async function withCredits<T>(
  reason: CreditReason,
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  // The caller must pass the identity verified by `requireSupabaseAuth`.
  // Never derive it from an unverified bearer token here.
  if (!userId) throw new Error("Unauthorized");


  const amount = CREDIT_COSTS[reason];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

