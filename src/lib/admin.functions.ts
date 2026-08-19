import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminGrantResult = {
  email: string;
  credits: number;
  balance: number;
};

export type AdminGrantEntry = {
  id: string;
  email: string;
  delta: number;
  createdAt: string;
};

export type AdminUsageStats = {
  totalAccounts: number;
  visitorsToday: number;
  visitorsWeek: number;
  visitorsMonth: number;
  scansToday: number;
  scansWeek: number;
  scansMonth: number;
  revenueMonthUsd: number;
  purchasesMonth: number;
  netPayoutMonthUsd: number;
};

/** Admin-only: visitors, scans and estimated net payout. */
export const getAdminUsageStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUsageStats> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) throw new Error("Not authorized");

    const { data, error } = await supabaseAdmin.rpc("get_admin_usage_stats");
    if (error) throw new Error(error.message);
    const row = (Array.isArray(data) ? data[0] : data) ?? {};

    const { data: countData, error: countError } = await supabaseAdmin.rpc(
      "get_total_user_count",
    );
    if (countError) throw new Error(countError.message);
    const totalAccounts = Array.isArray(countData)
      ? Number(countData[0] ?? 0)
      : Number(countData ?? 0);

    const revenueCents = Number(row.revenue_month_cents ?? 0);
    const purchases = Number(row.purchases_month ?? 0);
    const revenueMonthUsd = revenueCents / 100;
    // Payment provider fee: 5% + $0.50, or a flat 10% on sales under $10.
    const avg = purchases > 0 ? revenueMonthUsd / purchases : 0;
    const fees =
      purchases === 0
        ? 0
        : avg < 10
          ? revenueMonthUsd * 0.1
          : revenueMonthUsd * 0.05 + purchases * 0.5;

    return {
      visitorsToday: Number(row.visitors_today ?? 0),
      visitorsWeek: Number(row.visitors_week ?? 0),
      visitorsMonth: Number(row.visitors_month ?? 0),
      scansToday: Number(row.scans_today ?? 0),
      scansWeek: Number(row.scans_week ?? 0),
      scansMonth: Number(row.scans_month ?? 0),
      revenueMonthUsd,
      purchasesMonth: purchases,
      netPayoutMonthUsd: Math.max(0, revenueMonthUsd - fees),
    };
  });



/** True when the signed-in caller has the admin role. */
export const getIsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<boolean> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return data === true;
  });

/** Admin-only: add credits to any account, found by email. */
export const adminGrantCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; amount: number }) => {
    const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
    const amount = Number(input?.amount);
    if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Enter a valid email address");
    }
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000) {
      throw new Error("Amount must be a whole number between 1 and 100000");
    }
    return { email, amount };
  })
  .handler(async ({ data, context }): Promise<AdminGrantResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) throw new Error("Not authorized");

    // Find the target account by email.
    let targetId: string | null = null;
    for (let page = 1; page <= 20 && !targetId; page++) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 200,
      });
      if (error) throw new Error(error.message);
      const match = list.users.find((u) => (u.email ?? "").toLowerCase() === data.email);
      if (match) targetId = match.id;
      if (list.users.length < 200) break;
    }

    if (!targetId) throw new Error(`No account found for ${data.email}`);

    const { data: balance, error: grantError } = await supabaseAdmin.rpc("grant_credits", {
      _user_id: targetId,
      _amount: data.amount,
      _reason: "admin_grant",
    });
    if (grantError) throw new Error(grantError.message);

    return { email: data.email, credits: data.amount, balance: Number(balance ?? 0) };
  });

/** Admin-only: the most recent admin credit grants. */
export const getAdminGrants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminGrantEntry[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (isAdmin !== true) throw new Error("Not authorized");

    const { data: rows, error } = await supabaseAdmin
      .from("credit_ledger")
      .select("id, user_id, delta, created_at")
      .eq("reason", "admin_grant")
      .order("created_at", { ascending: false })
      .limit(15);
    if (error) throw new Error(error.message);

    const entries = rows ?? [];
    const emails = new Map<string, string>();
    await Promise.all(
      [...new Set(entries.map((r) => r.user_id))].map(async (id) => {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(id);
        if (u?.user?.email) emails.set(id, u.user.email);
      }),
    );

    return entries.map((r) => ({
      id: r.id,
      email: emails.get(r.user_id) ?? "unknown",
      delta: r.delta,
      createdAt: r.created_at,
    }));
  });
