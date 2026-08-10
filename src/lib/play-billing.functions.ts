import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CREDITS_BY_PLAY_PRODUCT } from "@/lib/play-products";
import { PLAY_SUBSCRIPTION_PRODUCT_IDS, type PlanType } from "@/lib/plan-mapping";

const RedeemSchema = z.object({
  productId: z.string().min(3).max(80),
  purchaseToken: z.string().min(8).max(2048),
});

export type RedeemPlayResult = {
  status: "granted" | "already_redeemed";
  balance: number;
};

/**
 * Verifies a Google Play one-time purchase server-side and credits the account.
 * The purchase token is unique-constrained, so it can only ever pay once.
 */
export const redeemPlayPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => RedeemSchema.parse(data))
  .handler(async ({ data, context }): Promise<RedeemPlayResult> => {
    const credits = CREDITS_BY_PLAY_PRODUCT[data.productId];
    if (!credits) throw new Error("Unknown product");

    const { verifyPlayProductPurchase, acknowledgePlayPurchase } = await import(
      "@/lib/play-billing.server"
    );

    const verified = await verifyPlayProductPurchase(data.productId, data.purchaseToken);
    if (!verified.valid) throw new Error("Purchase is not completed");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("redeem_play_purchase", {
      _user_id: context.userId,
      _purchase_token: data.purchaseToken,
      _product_id: data.productId,
      _order_id: verified.orderId ?? "",
      _credits: credits,
    });
    if (error) throw new Error(error.message);

    if (!verified.acknowledged) {
      await acknowledgePlayPurchase(data.productId, data.purchaseToken).catch(() => undefined);
    }

    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      status: (row?.status as RedeemPlayResult["status"]) ?? "granted",
      balance: Number(row?.balance ?? 0),
    };
  });

const SubscriptionRedeemSchema = z.object({
  productId: z.string().min(3).max(80),
  purchaseToken: z.string().min(8).max(2048),
  environment: z.enum(["sandbox", "live"]),
});

export type RedeemPlaySubscriptionResult = {
  status: "granted" | "already_redeemed";
  plan: PlanType;
};

/**
 * Verifies a Google Play subscription purchase server-side and records the
 * entitlement. The subscription must be active for the current period.
 */
export const redeemPlaySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => SubscriptionRedeemSchema.parse(data))
  .handler(async ({ data, context }): Promise<RedeemPlaySubscriptionResult> => {
    const plan = PLAY_SUBSCRIPTION_PRODUCT_IDS[data.productId];
    if (!plan) throw new Error("Unknown subscription");

    const { verifyPlaySubscriptionPurchase, acknowledgePlaySubscription } = await import(
      "@/lib/play-billing.server"
    );

    const verified = await verifyPlaySubscriptionPurchase(data.productId, data.purchaseToken);
    if (!verified.valid) throw new Error("Subscription is not active");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("play_subscriptions")
      .select("id")
      .eq("purchase_token", data.purchaseToken)
      .maybeSingle();

    if (existing) {
      return { status: "already_redeemed", plan };
    }

    const { error } = await supabaseAdmin.from("play_subscriptions").insert({
      user_id: context.userId,
      product_id: data.productId,
      purchase_token: data.purchaseToken,
      order_id: verified.orderId,
      plan,
      status: "active",
      current_period_start: verified.startTime,
      current_period_end: verified.expiryTime,
      environment: data.environment,
    });

    if (error) throw new Error(error.message);

    if (!verified.acknowledged) {
      await acknowledgePlaySubscription(data.productId, data.purchaseToken).catch(() => undefined);
    }

    return { status: "granted", plan };
  });
