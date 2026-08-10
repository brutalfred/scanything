import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

const EnvironmentSchema = z.enum(["sandbox", "live"]);

export type SubscriptionRow = Database["public"]["Tables"]["subscriptions"]["Row"];
export type PlaySubscriptionRow = Database["public"]["Tables"]["play_subscriptions"]["Row"];

export type ActiveSubscription =
  | (SubscriptionRow & { source: "paddle" })
  | (PlaySubscriptionRow & { source: "play" });

function isActive(
  row: { status: string; current_period_end: string | null },
): boolean {
  const grace =
    row.status === "canceled" && row.current_period_end
      ? new Date(row.current_period_end).getTime() > Date.now()
      : false;
  const live =
    ["active", "trialing"].includes(row.status) &&
    (!row.current_period_end || new Date(row.current_period_end).getTime() > Date.now());
  return live || grace;
}

function planRank(plan: string | null): number {
  if (plan === "max") return 2;
  if (plan === "pro") return 1;
  return 0;
}

export const getActiveSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ environment: EnvironmentSchema }).parse(data))
  .handler(async ({ data, context }): Promise<ActiveSubscription | null> => {
    const [{ data: paddleRows }, { data: playRows }] = await Promise.all([
      context.supabase.from("subscriptions").select("*").eq("user_id", context.userId).eq("environment", data.environment),
      context.supabase.from("play_subscriptions").select("*").eq("user_id", context.userId).eq("environment", data.environment),
    ]);

    const candidates = [
      ...(paddleRows ?? []).map((row) => ({ ...row, source: "paddle" as const })),
      ...(playRows ?? []).map((row) => ({ ...row, source: "play" as const })),
    ];

    const active = candidates.filter(isActive);
    if (active.length === 0) return null;

    active.sort((a, b) => {
      const rankDiff = planRank(a.plan) - planRank(b.plan);
      if (rankDiff !== 0) return rankDiff;
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });

    return active[0] ?? null;
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
