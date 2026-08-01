import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const EnvironmentSchema = z.enum(["sandbox", "live"]);

export type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];

export const getActiveSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ environment: EnvironmentSchema }).parse(data))
  .handler(async ({ data, context }): Promise<SubscriptionRow | null> => {
    const { data: row } = await context.supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return (row ?? null) as SubscriptionRow | null;
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ environment: EnvironmentSchema }).parse(data))
  .handler(async ({ data, context }): Promise<string> => {
    const { data: sub } = await context.supabase
      .from("subscriptions")
      .select("paddle_customer_id, paddle_subscription_id, environment")
      .eq("user_id", context.userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) {
      throw new Error("No active subscription to manage.");
    }

    const { getPaddleClient } = await import("@/lib/paddle.server");
    const paddle = getPaddleClient(sub.environment as "sandbox" | "live");
    const session = await paddle.customerPortalSessions.create(
      sub.paddle_customer_id,
      [sub.paddle_subscription_id],
    );

    return session.urls.general.overview as string;
  });
