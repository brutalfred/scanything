import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LeaderboardRow = {
  rank: number;
  displayName: string;
  timeMs: number;
  isMe: boolean;
};

export type SubmitScoreResult = {
  status: "recorded" | "improved" | "no_improvement";
  bestMonthMs: number | null;
  bestAllTimeMs: number | null;
};

/** Records a finished hurdles run; only improvements to the monthly best are kept. */
export const submitGameScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { timeMs: number; displayName?: string }) => {
    const timeMs = Math.round(Number(input?.timeMs));
    if (!Number.isFinite(timeMs) || timeMs < 9000 || timeMs > 600000) {
      throw new Error("invalid_time");
    }
    return {
      timeMs,
      displayName: (input.displayName ?? "").slice(0, 20),
    };
  })
  .handler(async ({ data, context }): Promise<SubmitScoreResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("submit_game_score", {
      _user_id: context.userId,
      _time_ms: data.timeMs,
      _display_name: data.displayName,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return {
      status: (row?.status as SubmitScoreResult["status"]) ?? "no_improvement",
      bestMonthMs: row?.best_month_ms == null ? null : Number(row.best_month_ms),
      bestAllTimeMs: row?.best_alltime_ms == null ? null : Number(row.best_alltime_ms),
    };
  });

/** Top times for the current month or all time. */
export const getGameLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { scope: "month" | "alltime"; limit: number }) => ({
    scope: input?.scope === "alltime" ? ("alltime" as const) : ("month" as const),
    limit: Math.min(Math.max(Math.round(Number(input?.limit) || 10), 1), 50),
  }))
  .handler(async ({ data, context }): Promise<LeaderboardRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("get_game_leaderboard", {
      _scope: data.scope,
      _limit: data.limit,
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: Record<string, unknown>) => ({
      rank: Number(r["rank"] ?? 0),
      displayName: String(r["display_name"] ?? "Runner"),
      timeMs: Number(r["time_ms"] ?? 0),
      isMe: Boolean(r["is_me"]),
    }));
  });
