import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Only this account may read the economics report. */
const OWNER_EMAIL = "scanythingapp@gmail.com";

export type ScanEconomics = {
  days: number;
  scans: number;
  avgScanCostUsd: number;
  totalCostUsd: number;
};

export const getScanEconomics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ days: z.number().int().min(1).max(365) }).parse(data))
  .handler(async ({ data, context }): Promise<ScanEconomics> => {
    const email = (context.claims as { email?: string } | null)?.email ?? "";
    if (email.toLowerCase() !== OWNER_EMAIL) throw new Error("Forbidden");

    const { microToUsd } = await import("./economics");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin.rpc("get_scan_economics", {
      _days: data.days,
    });
    if (error) throw new Error(error.message);

    const row = Array.isArray(rows) ? rows[0] : rows;
    const scans = Number(row?.scans ?? 0);
    const avgScanCostUsd = microToUsd(Number(row?.avg_scan_cost_micro_usd ?? 0));
    const totalCostUsd = microToUsd(Number(row?.total_cost_micro_usd ?? 0));

    return {
      days: data.days,
      scans,
      avgScanCostUsd,
      totalCostUsd,
    };
  });
