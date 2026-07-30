import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const CHECKIN_GOAL = 7;
export const CHECKIN_REWARD = 10;

export type CheckinState = {
  currentStreak: number;
  longestStreak: number;
  lastCheckinDate: string | null;
  totalRewards: number;
  checkedInToday: boolean;
};

export type CheckinResult = {
  status: "checked_in" | "already_checked_in" | "rewarded";
  currentStreak: number;
  rewarded: number;
  balance: number;
};

/** Current daily check-in streak for the signed-in account. */
export const getCheckinState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CheckinState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("get_checkin_state_for", {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      currentStreak: Number(row?.current_streak ?? 0),
      longestStreak: Number(row?.longest_streak ?? 0),
      lastCheckinDate: (row?.last_checkin_date as string | null) ?? null,
      totalRewards: Number(row?.total_rewards ?? 0),
      checkedInToday: Boolean(row?.checked_in_today),
    };
  });

/** Claims today's check-in; 7 days in a row grants bonus credits. */
export const claimDailyCheckin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CheckinResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("claim_daily_checkin_for", {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      status: (row?.status as CheckinResult["status"]) ?? "already_checked_in",
      currentStreak: Number(row?.current_streak ?? 0),
      rewarded: Number(row?.rewarded ?? 0),
      balance: Number(row?.balance ?? 0),
    };
  });
