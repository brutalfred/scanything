import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LedgerEntry = {
  id: string;
  delta: number;
  reason: string;
  createdAt: string;
};

export type CreditState = {
  balance: number;
  lastDailyGrantAt: string | null;
  ledger: LedgerEntry[];
};

export const getCreditState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreditState> => {
    const { supabase, userId } = context;

    const { data, error } = await supabase.rpc("get_credit_state");
    if (error) throw new Error(error.message);

    const row = Array.isArray(data) ? data[0] : data;

    const { data: ledger } = await supabase
      .from("credit_ledger")
      .select("id, delta, reason, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    return {
      balance: Number(row?.balance ?? 0),
      lastDailyGrantAt: (row?.last_daily_grant_at as string | null) ?? null,
      ledger: (ledger ?? []).map((l) => ({
        id: l.id,
        delta: l.delta,
        reason: l.reason,
        createdAt: l.created_at,
      })),
    };
  });

export type AdRewardStatus = {
  claimsToday: number;
  dailyLimit: number;
  reward: number;
};

export const getAdRewardStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdRewardStatus> => {
    const { data, error } = await context.supabase.rpc("get_ad_reward_status");
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      claimsToday: Number(row?.claims_today ?? 0),
      dailyLimit: Number(row?.daily_limit ?? 5),
      reward: Number(row?.reward ?? 2),
    };
  });

export const claimAdReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ balance: number; claimsToday: number }> => {
    const { data, error } = await context.supabase.rpc("claim_ad_reward");
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      balance: Number(row?.balance ?? 0),
      claimsToday: Number(row?.claims_today ?? 0),
    };
  });
