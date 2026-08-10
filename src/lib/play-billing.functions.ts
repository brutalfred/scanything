import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PLAY_SUBSCRIPTION_PRODUCT_IDS,
  type PlanType,
} from "@/lib/plan-mapping";

const SubscriptionRedeemSchema = z.object({
  productId: z.string().min(3).max(80),
  purchaseToken: z.string().min(8).max(2048),
  environment: z.enum(["sandbox", "live"]),
});

export type RedeemPlaySubscriptionResult = {
  status: "granted" | "already_redeemed";
  plan: PlanType;
};

export const redeemPlaySubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => SubscriptionRedeemSchema.parse(data))
  .handler(async ({ data, context }): Promise<RedeemPlaySubscriptionResult> => {
    const plan = PLAY_SUBSCRIPTION_PRODUCT_IDS[data.productId];
    if (!plan) throw new Error("Unknown subscription");

    const { verifyPlaySubscriptionPurchase, acknowledgePlaySubscription } = await import(
      "@/lib/play-billing.server"
    );

    const verified = await verifyPlaySubscriptionPurchase(
      data.productId,
      data.purchaseToken,
    );
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
      await acknowledgePlaySubscription(data.productId, data.purchaseToken).catch(
        () => undefined,
      );
    }

    return { status: "granted", plan };
  });
