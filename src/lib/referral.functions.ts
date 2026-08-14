import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const REFERRAL_REWARD = 50;

export type ReferralStats = {
  code: string;
  invited: number;
  creditsEarned: number;
  /** True when this account has already used somebody else's invite code. */
  redeemed: boolean;
};

export type RedeemReferralResult = {
  status: "redeemed" | "already_redeemed" | "invalid_code" | "self_referral";
  reward: number;
};

/** Invite code + totals for the signed-in account (code is created on first call). */
export const getReferralStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReferralStats> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("get_referral_stats_for", {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      code: String(row?.code ?? ""),
      invited: Number(row?.invited ?? 0),
      creditsEarned: Number(row?.credits_earned ?? 0),
      redeemed: Boolean(row?.redeemed),
    };
  });

/** Redeems a friend's invite code — both accounts get credits. */
export const redeemReferralCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    const code = String(input?.code ?? "")
      .trim()
      .toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(code)) throw new Error("invalid_code");
    return { code };
  })
  .handler(async ({ data, context }): Promise<RedeemReferralResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rpcData, error } = await supabaseAdmin.rpc("redeem_referral_code_for", {
      _user_id: context.userId,
      _code: data.code,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    return {
      status: (row?.status as RedeemReferralResult["status"]) ?? "invalid_code",
      reward: Number(row?.reward ?? 0),
    };
  });
