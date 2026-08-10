import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { CREDIT_COSTS, INSUFFICIENT_CREDITS, type CreditReason } from "./credits";
import {
  PLAN_WAIVED_REASONS,
  inferPlanFromProductId,
  type PlanType,
} from "./plan-mapping";

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

function isActiveRow(row: {
  status: string;
  current_period_end: string | null;
}): boolean {
  const now = Date.now();
  const periodEnd = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
  const active =
    ["active", "trialing"].includes(row.status) && (periodEnd === null || periodEnd > now);
  const grace = row.status === "canceled" && periodEnd !== null && periodEnd > now;
  return active || grace;
}

export async function getActiveUserPlan(
  userId: string,
  environment?: "sandbox" | "live",
): Promise<PlanType | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const env = environment ?? "live";

  const [{ data: paddleRows }, { data: playRows }] = await Promise.all([
    supabaseAdmin
      .from("subscriptions")
      .select("plan, product_id, status, current_period_end")
      .eq("user_id", userId)
      .eq("environment", env),
    supabaseAdmin
      .from("play_subscriptions")
      .select("plan, product_id, status, current_period_end")
      .eq("user_id", userId)
      .eq("environment", env),
  ]);

  const rows = [
    ...(paddleRows ?? []).map((row) => ({
      ...row,
      plan: (row.plan ?? inferPlanFromProductId(row.product_id)) as PlanType | null,
    })),
    ...(playRows ?? []).map((row) => ({
      ...row,
      plan: (row.plan ?? inferPlanFromProductId(row.product_id)) as PlanType | null,
    })),
  ];

  const active = rows.filter((row) => row.plan !== null && isActiveRow(row));

  if (active.some((row) => row.plan === "max")) return "max";
  if (active.some((row) => row.plan === "pro")) return "pro";
  return null;
}

export async function hasActiveSubscription(
  userId: string,
  environment?: "sandbox" | "live",
): Promise<boolean> {
  const plan = await getActiveUserPlan(userId, environment);
  return plan !== null;
}

/**
 * Runs `fn` behind a credit debit.
 *
 * Requires a verified user id (from `requireSupabaseAuth`). Active Scanything
 * Pro or Max subscribers skip credit consumption for the covered scan modes.
 */
export async function withCredits<T>(
  reason: CreditReason,
  userId: string,
  fn: () => Promise<T>,
  environment?: "sandbox" | "live",
): Promise<T> {
  if (!userId) throw new Error("Unauthorized");

  const amount = CREDIT_COSTS[reason];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // One free photo/resale scan per day for signed-in users.
  // Claimed before the subscription check so the daily counter is always
  // consumed exactly once per 24h, for subscribers too.
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

  const plan = await getActiveUserPlan(userId, environment);
  if (plan && PLAN_WAIVED_REASONS[plan].includes(reason)) {
    return await fn();
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
