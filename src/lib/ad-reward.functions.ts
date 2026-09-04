import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdRewardStatus = {
  claimsToday: number;
  dailyLimit: number;
};

export type AdRewardResult = {
  status: "granted" | "limit_reached";
  balance: number;
  claimsToday: number;
  dailyLimit: number;
};

/** How many rewarded commercials the signed-in account has watched today. */
export const getAdRewardStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdRewardStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("get_ad_reward_status_for", {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      claimsToday: Number(row?.claims_today ?? 0),
      dailyLimit: Number(row?.daily_limit ?? 5),
    };
  });

/** Grants 5 credits after a commercial has been watched, capped at 5 ads per day. */
export const claimAdReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdRewardResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("claim_ad_reward_for", {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      status: (row?.status as AdRewardResult["status"]) ?? "limit_reached",
      balance: Number(row?.balance ?? 0),
      claimsToday: Number(row?.claims_today ?? 0),
      dailyLimit: Number(row?.daily_limit ?? 5),
    };
  });
