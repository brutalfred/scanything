import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isDisposableEmail } from "@/lib/email-domains";

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

/** Starts a server-tracked ad view. The returned id is required to claim the reward. */
export const startAdSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ sessionId: string }> => {
    const { data, error } = await context.supabase.rpc("start_ad_session");
    if (error) throw new Error(error.message);
    return { sessionId: data as unknown as string };
  });

export const claimAdReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sessionId: string }) => {
    if (!input || typeof input.sessionId !== "string" || !input.sessionId) {
      throw new Error("ad_session_invalid");
    }
    return { sessionId: input.sessionId };
  })
  .handler(async ({ data, context }): Promise<{ balance: number; claimsToday: number }> => {
    const { data: rpcData, error } = await context.supabase.rpc("claim_ad_reward", {
      _session_id: data.sessionId,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    return {
      balance: Number(row?.balance ?? 0),
      claimsToday: Number(row?.claims_today ?? 0),
    };
  });

export type SignupGrantResult = {
  status: "granted" | "already_claimed" | "device_used" | "blocked_email";
  balance: number;
};

/**
 * One-time free trial grant. Limited to one per device, and refused for
 * disposable email addresses.
 */
export const claimSignupGrant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { deviceHash: string }) => {
    const hash = typeof input?.deviceHash === "string" ? input.deviceHash.trim() : "";
    if (hash.length < 16 || hash.length > 128) throw new Error("invalid_device");
    return { deviceHash: hash };
  })
  .handler(async ({ data, context }): Promise<SignupGrantResult> => {
    const email = (context.claims?.email as string | undefined) ?? "";
    if (email && isDisposableEmail(email)) {
      return { status: "blocked_email", balance: 0 };
    }

    const { data: rpcData, error } = await context.supabase.rpc("claim_signup_grant", {
      _device_hash: data.deviceHash,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    return {
      status: (row?.status as SignupGrantResult["status"]) ?? "already_claimed",
      balance: Number(row?.balance ?? 0),
    };
  });
