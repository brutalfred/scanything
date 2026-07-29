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

function getBearerToken(): string | null {
  const header = getRequestHeader("authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token || token.split(".").length !== 3) return null;
  return token;
}

/**
 * Runs `fn` behind a credit debit.
 *
 * Signed-in callers are charged server-side and refunded when the AI call fails.
 * Anonymous visitors run on the client-tracked free trial allowance.
 */
export async function withCredits<T>(reason: CreditReason, fn: () => Promise<T>): Promise<T> {
  const token = getBearerToken();
  if (!token) return fn();

  const amount = CREDIT_COSTS[reason];
  const supabase = createUserClient(token);

  const { error } = await supabase.rpc("spend_credits", {
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
    await supabase.rpc("refund_credits", { _amount: amount, _reason: `refund:${reason}` });
    throw err;
  }
}
