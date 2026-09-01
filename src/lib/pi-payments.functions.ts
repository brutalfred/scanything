import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CREDIT_PACKS } from "@/lib/credit-packs";

const PI_API = "https://api.minepi.com/v2";

/** Fallback used only if the rate feed has never been reachable. */
const FALLBACK_USD_PER_PI = 0.35;

export type PiPack = {
  packId: string;
  label: string;
  credits: number;
  usd: number;
  /** Pi amount for this pack at today's rate. */
  pi: number;
};

export type PiPacksResult = {
  usdPerPi: number;
  updatedAt: string;
  packs: PiPack[];
};

function usdOf(priceLabel: string): number {
  return Number(priceLabel.replace(/[^0-9.]/g, "")) || 0;
}

function roundPi(value: number): number {
  // Two decimals is plenty of precision for a Pi price and keeps memos tidy.
  return Math.max(0.01, Math.round(value * 100) / 100);
}

function packsFor(usdPerPi: number): PiPack[] {
  return CREDIT_PACKS.map((p) => {
    const usd = usdOf(p.priceLabel);
    return {
      packId: p.priceId,
      label: p.label,
      credits: p.credits,
      usd,
      pi: roundPi(usd / usdPerPi),
    };
  });
}

/** Reads the cached Pi/USD rate, refreshing it from the market once a day. */
async function currentRate(): Promise<{ usdPerPi: number; updatedAt: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: row } = await supabaseAdmin
    .from("pi_rate")
    .select("usd_per_pi, updated_at")
    .eq("id", true)
    .maybeSingle();

  const cached = Number(row?.usd_per_pi ?? FALLBACK_USD_PER_PI);
  const updatedAt = row?.updated_at ?? new Date(0).toISOString();
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  if (ageMs < 24 * 60 * 60 * 1000 && cached > 0) {
    return { usdPerPi: cached, updatedAt };
  }

  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=pi-network&vs_currencies=usd",
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) throw new Error("rate feed unavailable");
    const json = (await res.json()) as { "pi-network"?: { usd?: number } };
    const fresh = Number(json?.["pi-network"]?.usd);
    if (!Number.isFinite(fresh) || fresh <= 0) throw new Error("bad rate");

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("pi_rate")
      .upsert({ id: true, usd_per_pi: fresh, updated_at: now }, { onConflict: "id" });
    return { usdPerPi: fresh, updatedAt: now };
  } catch {
    // Keep selling at the last known rate rather than failing the purchase.
    return { usdPerPi: cached > 0 ? cached : FALLBACK_USD_PER_PI, updatedAt };
  }
}

/** Credit packs priced in Pi at today's exchange rate. */
export const getPiCreditPacks = createServerFn({ method: "POST" }).handler(
  async (): Promise<PiPacksResult> => {
    const { usdPerPi, updatedAt } = await currentRate();
    return { usdPerPi, updatedAt, packs: packsFor(usdPerPi) };
  },
);

function piHeaders(): HeadersInit {
  const key = process.env["PI_NETWORK_API_KEY"];
  if (!key) throw new Error("Pi payments are not configured yet");
  return { Authorization: `Key ${key}`, "Content-Type": "application/json" };
}

type PiPaymentDto = {
  identifier?: string;
  amount?: number;
  memo?: string;
  metadata?: { packId?: string } | null;
  user_uid?: string;
  status?: {
    developer_approved?: boolean;
    transaction_verified?: boolean;
    developer_completed?: boolean;
    cancelled?: boolean;
    user_cancelled?: boolean;
  };
  transaction?: { txid?: string } | null;
};

async function fetchPiPayment(paymentId: string): Promise<PiPaymentDto> {
  const res = await fetch(`${PI_API}/payments/${paymentId}`, { headers: piHeaders() });
  if (!res.ok) throw new Error("Could not read this Pi payment");
  return (await res.json()) as PiPaymentDto;
}

export type PiApproveResult = { approved: true; credits: number; pi: number };

/**
 * Server-side approval. Verifies the payment really belongs to the signed-in
 * user's Pi identity and that its amount matches the pack it claims to buy,
 * then calls Pi's approve endpoint.
 */
export const piApprovePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string }) => {
    const paymentId = String(input?.paymentId ?? "").trim();
    if (!paymentId || paymentId.length > 128) throw new Error("Invalid payment");
    return { paymentId };
  })
  .handler(async ({ data, context }): Promise<PiApproveResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payment = await fetchPiPayment(data.paymentId);
    const packId = payment.metadata?.packId ?? "";
    const pack = CREDIT_PACKS.find((p) => p.priceId === packId);
    if (!pack) throw new Error("Unknown credit pack");

    // The payer must be the Pi identity linked to the signed-in account.
    const { data: identity } = await supabaseAdmin
      .from("pi_identities")
      .select("pi_uid")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!identity?.pi_uid || identity.pi_uid !== payment.user_uid) {
      throw new Error("This payment belongs to a different Pi account");
    }

    // Re-price server-side; never trust the amount the browser asked for.
    const { usdPerPi } = await currentRate();
    const expected = roundPi(usdOf(pack.priceLabel) / usdPerPi);
    const amount = Number(payment.amount ?? 0);
    // Allow a small tolerance for rate drift between quote and approval.
    if (!(amount > 0) || amount < expected * 0.85) {
      throw new Error("Payment amount does not match this pack");
    }

    const { error: insertError } = await supabaseAdmin.from("pi_payments").upsert(
      {
        payment_id: data.paymentId,
        user_id: context.userId,
        pack_id: pack.priceId,
        credits: pack.credits,
        amount_pi: amount,
        status: "approved",
      },
      { onConflict: "payment_id" },
    );
    if (insertError) throw new Error("Could not record this Pi payment");

    const res = await fetch(`${PI_API}/payments/${data.paymentId}/approve`, {
      method: "POST",
      headers: piHeaders(),
    });
    if (!res.ok && res.status !== 400) {
      throw new Error("Pi could not approve this payment");
    }

    return { approved: true, credits: pack.credits, pi: amount };
  });

export type PiCompleteResult = {
  status: "granted" | "already_completed";
  credits: number;
  balance: number;
};

/**
 * Server-side completion: tells Pi the transaction is settled and grants the
 * credits exactly once. Also used to recover incomplete payments.
 */
export const piCompletePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string; txid?: string }) => {
    const paymentId = String(input?.paymentId ?? "").trim();
    if (!paymentId || paymentId.length > 128) throw new Error("Invalid payment");
    const raw = String(input?.txid ?? "").trim();
    const txid = raw && raw.length <= 128 ? raw : undefined;
    return { paymentId, txid };
  })
  .handler(async ({ data, context }): Promise<PiCompleteResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("pi_payments")
      .select("user_id")
      .eq("payment_id", data.paymentId)
      .maybeSingle();
    if (!row) throw new Error("Unknown Pi payment");
    if (row.user_id !== context.userId) throw new Error("Not your payment");

    let txid = data.txid;
    if (!txid) {
      const payment = await fetchPiPayment(data.paymentId);
      txid = payment.transaction?.txid ?? undefined;
    }
    if (!txid) throw new Error("This Pi payment has no transaction yet");

    const res = await fetch(`${PI_API}/payments/${data.paymentId}/complete`, {
      method: "POST",
      headers: piHeaders(),
      body: JSON.stringify({ txid }),
    });
    if (!res.ok && res.status !== 400) {
      throw new Error("Pi could not complete this payment");
    }

    const { data: redeemed, error } = await supabaseAdmin.rpc("redeem_pi_payment", {
      _payment_id: data.paymentId,
      _txid: txid,
    });
    if (error) throw new Error(error.message);
    const result = Array.isArray(redeemed) ? redeemed[0] : redeemed;

    return {
      status: (result?.status as PiCompleteResult["status"]) ?? "granted",
      credits: Number(result?.credits ?? 0),
      balance: Number(result?.balance ?? 0),
    };
  });

/** Marks a payment the Pioneer cancelled, so it stops being retried. */
export const piCancelPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string }) => {
    const paymentId = String(input?.paymentId ?? "").trim();
    if (!paymentId || paymentId.length > 128) throw new Error("Invalid payment");
    return { paymentId };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("pi_payments")
      .update({ status: "cancelled" })
      .eq("payment_id", data.paymentId)
      .eq("user_id", context.userId)
      .neq("status", "completed");
    return { ok: true };
  });
