import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DataCategory =
  | "scan_history"
  | "ai_usage"
  | "game_scores"
  | "activity"
  | "checkins";

const CATEGORY_TABLES: Record<DataCategory, readonly string[]> = {
  scan_history: ["scan_history"],
  ai_usage: ["ai_usage"],
  game_scores: ["game_scores"],
  activity: ["account_visits", "daily_free_scans"],
  checkins: ["checkin_streaks"],
};

/**
 * Deletes selected categories of the signed-in user's data without
 * deleting their account (Google Play data-deletion requirement).
 */
export const deleteMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { categories: DataCategory[] }) => {
    const valid = (input?.categories ?? []).filter(
      (c): c is DataCategory => c in CATEGORY_TABLES,
    );
    if (valid.length === 0) throw new Error("No valid data categories selected");
    return { categories: valid };
  })
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const deleted: string[] = [];
    for (const category of data.categories) {
      for (const table of CATEGORY_TABLES[category]) {
        const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
        if (error) throw new Error(`Could not delete ${table}: ${error.message}`);
        deleted.push(table);
      }
    }

    return { deleted };
  });


/**
 * Permanently deletes the signed-in user's account and all of their data.
 * Required by Google Play's account deletion policy.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tables = [
      "ai_usage",
      "ad_reward_claims",
      "checkin_streaks",
      "credit_ledger",
      "credit_purchases",
      "play_purchases",
      "user_roles",
      "credit_accounts",
    ] as const;

    for (const table of tables) {
      const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
      if (error) throw new Error(`Could not delete ${table}: ${error.message}`);
    }

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authError) throw new Error(authError.message);

    return { deleted: true };
  });
