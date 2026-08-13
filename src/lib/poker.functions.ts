import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TableSummary, TableView } from "./poker";

export const getPokerLobby = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ tables: TableSummary[]; chips: number }> => {
    const store = await import("./poker-store.server");
    const [tables, chips] = await Promise.all([
      store.listTables(),
      store.ensureChips(context.userId),
    ]);
    return { tables, chips };
  });

export const createPokerTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name?: string; maxSeats?: number; solo?: boolean }) => ({
    name: (input?.name ?? "").slice(0, 30),
    maxSeats: Math.min(Math.max(Math.round(Number(input?.maxSeats) || 4), 2), 4),
    solo: Boolean(input?.solo),
  }))
  .handler(async ({ data, context }): Promise<{ tableId: string }> => {
    const store = await import("./poker-store.server");
    const displayName = (context.claims["email"] as string | undefined)?.split("@")[0] ?? "Player";
    const tableId = await store.createTable({
      userId: context.userId,
      displayName,
      name: data.name || `${displayName}'s table`,
      maxSeats: data.solo ? 4 : data.maxSeats,
      isPrivate: data.solo,
      solo: data.solo,
    });
    return { tableId };
  });

export const joinPokerTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tableId: string }) => ({ tableId: String(input.tableId) }))
  .handler(async ({ data, context }) => {
    const store = await import("./poker-store.server");
    const displayName = (context.claims["email"] as string | undefined)?.split("@")[0] ?? "Player";
    await store.joinTable({ tableId: data.tableId, userId: context.userId, displayName });
    return { ok: true };
  });

export const leavePokerTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tableId: string }) => ({ tableId: String(input.tableId) }))
  .handler(async ({ data, context }) => {
    const store = await import("./poker-store.server");
    await store.leaveTable(data.tableId, context.userId);
    return { ok: true };
  });

export const addPokerBots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tableId: string; count?: number }) => ({
    tableId: String(input.tableId),
    count: Math.min(Math.max(Math.round(Number(input?.count) || 1), 1), 3),
  }))
  .handler(async ({ data }) => {
    const store = await import("./poker-store.server");
    await store.addBots(data.tableId, data.count);
    return { ok: true };
  });

export const startPokerHand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tableId: string }) => ({ tableId: String(input.tableId) }))
  .handler(async ({ data }) => {
    const store = await import("./poker-store.server");
    await store.startHand(data.tableId);
    return { ok: true };
  });

export const pokerAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tableId: string; action: string; amount?: number }) => {
    const allowed = ["fold", "check", "call", "raise", "allin"] as const;
    const action = allowed.find((a) => a === input.action);
    if (!action) throw new Error("invalid_action");
    return {
      tableId: String(input.tableId),
      action,
      amount: Math.max(0, Math.round(Number(input?.amount) || 0)),
    };
  })
  .handler(async ({ data, context }) => {
    const store = await import("./poker-store.server");
    await store.performAction(data.tableId, context.userId, data.action, data.amount);
    return { ok: true };
  });

export const tickPokerTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tableId: string }) => ({ tableId: String(input.tableId) }))
  .handler(async ({ data }) => {
    const store = await import("./poker-store.server");
    await store.tick(data.tableId);
    return { ok: true };
  });

export const getPokerTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { tableId: string }) => ({ tableId: String(input.tableId) }))
  .handler(async ({ data, context }): Promise<TableView> => {
    const store = await import("./poker-store.server");
    return store.getTableView(data.tableId, context.userId);
  });
