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
  /** True when today's one free photo/resale scan has not been used yet. */
  freeScanAvailable: boolean;
  ledger: LedgerEntry[];
};


export const getCreditState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreditState> => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // A freshly-minted token can be a second ahead of the database clock
    // ("JWT issued at future"). Retry briefly instead of failing the page.
    let row: {
      balance?: number | string;
      last_daily_grant_at?: string | null;
      free_scan_available?: boolean | null;
    } | null = null;
    let lastError: string | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabaseAdmin.rpc("get_credit_state_for", {
        _user_id: userId,
      });
      if (!error) {
        row = (Array.isArray(data) ? data[0] : data) ?? null;
        lastError = null;
        break;
      }
      lastError = error.message;
      if (!/issued at future|clock/i.test(error.message)) break;
      await new Promise((r) => setTimeout(r, 700));
    }
    if (lastError) throw new Error(lastError);




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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rpcData, error } = await supabaseAdmin.rpc("claim_signup_grant_for", {
      _user_id: context.userId,
      _device_hash: data.deviceHash,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    return {
      status: (row?.status as SignupGrantResult["status"]) ?? "already_claimed",
      balance: Number(row?.balance ?? 0),
    };
  });

export type AccountStats = {
  photoScans: number;
  creditsSpent: number;
};

/** Lifetime account totals derived from the credit ledger. */
export const getAccountStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountStats> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("credit_ledger")
      .select("delta, reason")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    let photoScans = 0;
    let creditsSpent = 0;
    for (const row of data ?? []) {
      if (row.reason === "photo_scan") photoScans += 1;
      if (row.delta < 0) creditsSpent += -row.delta;
    }
    return { photoScans, creditsSpent };
  });
