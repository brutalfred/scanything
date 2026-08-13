/** Server-only persistence + orchestration for the poker game. */
import { REBUY_CHIPS, STARTING_CHIPS, type TableSummary, type TableView } from "./poker";
import {
  BOT_NAMES,
  applyAction,
  botAction,
  buildNewHand,
  legalActions,
  progress,
  type GameState,
  type HandRow,
  type SeatRow,
  type TableRow,
} from "./poker.server";

const BUY_IN = 2000;
const NEXT_HAND_DELAY_MS = 4500;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/* --------------------------------- chips --------------------------------- */

export async function ensureChips(userId: string): Promise<number> {
  const db = await admin();
  const { data } = await db.from("poker_chips").select("chips").eq("user_id", userId).maybeSingle();
  if (!data) {
    await db.from("poker_chips").insert({ user_id: userId, chips: STARTING_CHIPS });
    return STARTING_CHIPS;
  }
  if (data.chips <= 0) {
    await db.from("poker_chips").update({ chips: REBUY_CHIPS }).eq("user_id", userId);
    return REBUY_CHIPS;
  }
  return data.chips;
}

async function setChips(userId: string, chips: number) {
  const db = await admin();
  await db.from("poker_chips").update({ chips: Math.max(0, chips) }).eq("user_id", userId);
}

/* --------------------------------- lobby ---------------------------------- */

export async function listTables(): Promise<TableSummary[]> {
  const db = await admin();
  const { data: tables } = await db
    .from("poker_tables")
    .select("id, name, status, max_seats, small_blind, big_blind")
    .eq("is_private", false)
    .neq("status", "finished")
    .order("created_at", { ascending: false })
    .limit(30);

  const ids = (tables ?? []).map((t) => t.id);
  const { data: seats } = ids.length
    ? await db.from("poker_seats").select("table_id, user_id, is_bot").in("table_id", ids)
    : { data: [] as { table_id: string; user_id: string | null; is_bot: boolean }[] };

  return (tables ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    seated: (seats ?? []).filter((s) => s.table_id === t.id && (s.user_id || s.is_bot)).length,
    maxSeats: t.max_seats,
    smallBlind: t.small_blind,
    bigBlind: t.big_blind,
  }));
}

export async function createTable(opts: {
  userId: string;
  displayName: string;
  name: string;
  maxSeats: number;
  isPrivate: boolean;
  solo: boolean;
}): Promise<string> {
  const db = await admin();
  const { data: table, error } = await db
    .from("poker_tables")
    .insert({
      name: opts.name,
      host_id: opts.userId,
      max_seats: opts.maxSeats,
      is_private: opts.isPrivate,
      status: "waiting",
    })
    .select("*")
    .single();
  if (error || !table) throw new Error(error?.message ?? "create_failed");

  const rows = Array.from({ length: opts.maxSeats }, (_, i) => ({
    table_id: table.id,
    seat_index: i,
  }));
  await db.from("poker_seats").insert(rows);

  await joinTable({ tableId: table.id, userId: opts.userId, displayName: opts.displayName });
  if (opts.solo) {
    await addBots(table.id, opts.maxSeats - 1);
    await startHand(table.id);
  }
  return table.id;
}

export async function joinTable(opts: { tableId: string; userId: string; displayName: string }) {
  const db = await admin();
  const { data: seats } = await db
    .from("poker_seats")
    .select("*")
    .eq("table_id", opts.tableId)
    .order("seat_index");
  const rows = (seats ?? []) as SeatRow[];
  if (rows.some((s) => s.user_id === opts.userId)) return;

  const free = rows.find((s) => !s.user_id && !s.is_bot);
  if (!free) throw new Error("table_full");

  const chips = await ensureChips(opts.userId);
  const buyIn = Math.min(chips, BUY_IN);
  await setChips(opts.userId, chips - buyIn);

  await db
    .from("poker_seats")
    .update({
      user_id: opts.userId,
      is_bot: false,
      display_name: opts.displayName.slice(0, 20) || "Player",
      stack: buyIn,
      in_hand: false,
      folded: false,
      all_in: false,
      current_bet: 0,
      total_committed: 0,
      has_acted: false,
      last_action: null,
      shown_cards: null,
    })
    .eq("id", free.id);
  await bumpVersion(opts.tableId);
}

export async function addBots(tableId: string, count: number) {
  const db = await admin();
  const { data: seats } = await db.from("poker_seats").select("*").eq("table_id", tableId);
  const free = ((seats ?? []) as SeatRow[])
    .filter((s) => !s.user_id && !s.is_bot)
    .sort((a, b) => a.seat_index - b.seat_index)
    .slice(0, Math.max(0, count));
  let n = 0;
  for (const seat of free) {
    await db
      .from("poker_seats")
      .update({
        is_bot: true,
        user_id: null,
        display_name: BOT_NAMES[n % BOT_NAMES.length]!,
        stack: BUY_IN,
      })
      .eq("id", seat.id);
    n++;
  }
  await bumpVersion(tableId);
}

export async function leaveTable(tableId: string, userId: string) {
  const db = await admin();
  const { data: seat } = await db
    .from("poker_seats")
    .select("*")
    .eq("table_id", tableId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!seat) return;

  const chips = await ensureChips(userId);
  await setChips(userId, chips + (seat.stack ?? 0));

  await db
    .from("poker_seats")
    .update({
      user_id: null,
      is_bot: false,
      display_name: "Player",
      stack: 0,
      in_hand: false,
      folded: true,
      all_in: false,
      current_bet: 0,
      total_committed: 0,
      has_acted: true,
      last_action: null,
      shown_cards: null,
    })
    .eq("id", seat.id);

  const { data: rest } = await db.from("poker_seats").select("user_id, is_bot").eq("table_id", tableId);
  const humans = (rest ?? []).filter((s) => s.user_id).length;
  if (humans === 0) {
    await db.from("poker_tables").update({ status: "finished" }).eq("id", tableId);
  } else {
    await bumpVersion(tableId);
  }
}

async function bumpVersion(tableId: string) {
  const db = await admin();
  const { data } = await db.from("poker_tables").select("version").eq("id", tableId).maybeSingle();
  await db
    .from("poker_tables")
    .update({ version: (data?.version ?? 0) + 1 })
    .eq("id", tableId);
}

/* ------------------------------- game state ------------------------------- */

async function loadState(tableId: string): Promise<{ state: GameState | null; table: TableRow }> {
  const db = await admin();
  const { data: table } = await db.from("poker_tables").select("*").eq("id", tableId).single();
  if (!table) throw new Error("table_not_found");
  const { data: seats } = await db
    .from("poker_seats")
    .select("*")
    .eq("table_id", tableId)
    .order("seat_index");
  const { data: hand } = await db
    .from("poker_hands")
    .select("*")
    .eq("table_id", tableId)
    .order("hand_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const tableRow = table as unknown as TableRow;
  if (!hand) return { state: null, table: tableRow };
  return {
    state: {
      table: tableRow,
      seats: (seats ?? []) as unknown as SeatRow[],
      hand: hand as unknown as HandRow,
    },
    table: tableRow,
  };
}

async function saveState(state: GameState) {
  const db = await admin();
  for (const s of state.seats) {
    await db
      .from("poker_seats")
      .update({
        stack: s.stack,
        current_bet: s.current_bet,
        total_committed: s.total_committed,
        folded: s.folded,
        all_in: s.all_in,
        has_acted: s.has_acted,
        in_hand: s.in_hand,
        last_action: s.last_action,
        shown_cards: s.shown_cards,
      })
      .eq("id", s.id);
  }
  const h = state.hand;
  await db
    .from("poker_hands")
    .update({
      deck: h.deck,
      board: h.board,
      pot: h.pot,
      stage: h.stage,
      acting_seat: h.acting_seat,
      current_bet: h.current_bet,
      min_raise: h.min_raise,
      action_deadline: h.action_deadline,
      status: h.status,
      result_text: h.result_text,
      winners: h.winners,
    })
    .eq("id", h.id);
  await bumpVersion(state.table.id);
}

export async function startHand(tableId: string) {
  const db = await admin();
  const { state, table } = await loadState(tableId);
  if (state && state.hand.status === "active") return;

  const { data: seatRows } = await db
    .from("poker_seats")
    .select("*")
    .eq("table_id", tableId)
    .order("seat_index");
  const seats = (seatRows ?? []) as unknown as SeatRow[];

  // top up empty stacks so nobody is stuck at a live table
  for (const s of seats) {
    if ((s.user_id || s.is_bot) && s.stack <= 0) s.stack = REBUY_CHIPS;
  }

  const players = seats.filter((s) => (s.user_id || s.is_bot) && s.stack > 0);
  if (players.length < 2) return;

  const handNo = (state?.hand.hand_no ?? 0) + 1;
  const prevDealer = state?.hand.dealer_seat ?? -1;
  const built = buildNewHand(table, seats, handNo, prevDealer);

  const { data: inserted } = await db
    .from("poker_hands")
    .insert({ table_id: tableId, ...built.hand })
    .select("*")
    .single();
  if (!inserted) throw new Error("hand_insert_failed");

  await db.from("poker_tables").update({ status: "playing" }).eq("id", tableId);

  const next: GameState = {
    table,
    seats: built.seats,
    hand: inserted as unknown as HandRow,
  };
  await saveState(next);
  await runBots(tableId);
}

export async function performAction(
  tableId: string,
  userId: string,
  action: "fold" | "check" | "call" | "raise" | "allin",
  amount: number,
) {
  const { state } = await loadState(tableId);
  if (!state || state.hand.status !== "active") throw new Error("no_active_hand");
  const seat = state.seats.find((s) => s.user_id === userId);
  if (!seat) throw new Error("not_seated");
  applyAction(state, seat.seat_index, action, amount);
  await saveState(state);
  await runBots(tableId);
}

/** Drives bot turns and enforces the turn clock. Called by clients as a heartbeat. */
export async function tick(tableId: string) {
  const db = await admin();
  const { state } = await loadState(tableId);
  if (!state) return;
  const hand = state.hand;

  if (hand.status === "complete") {
    const done = new Date(hand.updated_at ?? Date.now()).getTime();
    const stale = Date.now() - (Number.isNaN(done) ? 0 : done) > NEXT_HAND_DELAY_MS;
    const seated = state.seats.filter((s) => s.user_id || s.is_bot);
    if (stale && seated.length >= 2) {
      // return busted human stacks to their chip bank before the next hand
      await startHand(tableId);
    }
    return;
  }

  const acting = state.seats.find((s) => s.seat_index === hand.acting_seat);
  if (!acting) {
    progress(state);
    await saveState(state);
    return;
  }

  if (acting.is_bot) {
    await runBots(tableId);
    return;
  }

  const deadline = hand.action_deadline ? new Date(hand.action_deadline).getTime() : null;
  if (deadline && Date.now() > deadline + 1500) {
    const info = legalActions(state, acting.seat_index)!;
    applyAction(state, acting.seat_index, info.canCheck ? "check" : "fold");
    await saveState(state);
    await runBots(tableId);
  }
  void db;
}

async function runBots(tableId: string) {
  for (let i = 0; i < 24; i++) {
    const { state } = await loadState(tableId);
    if (!state || state.hand.status !== "active") return;
    const acting = state.seats.find((s) => s.seat_index === state.hand.acting_seat);
    if (!acting || !acting.is_bot) return;
    botAction(state, acting.seat_index);
    await saveState(state);
  }
}

/* --------------------------------- views ---------------------------------- */

export async function getTableView(tableId: string, userId: string): Promise<TableView> {
  const { state, table } = await loadState(tableId);
  const db = await admin();
  const { data: seatRows } = await db
    .from("poker_seats")
    .select("*")
    .eq("table_id", tableId)
    .order("seat_index");
  const seats = (state?.seats ?? ((seatRows ?? []) as unknown as SeatRow[])) as SeatRow[];
  const mySeat = seats.find((s) => s.user_id === userId) ?? null;
  const chips = await ensureChips(userId);
  const hand = state?.hand ?? null;
  const showdown = hand?.stage === "showdown" || hand?.status === "complete";

  return {
    id: table.id,
    name: table.name,
    status: table.status as TableView["status"],
    maxSeats: table.max_seats,
    smallBlind: table.small_blind,
    bigBlind: table.big_blind,
    isPrivate: table.is_private,
    hostId: table.host_id,
    chips,
    mySeat: mySeat?.seat_index ?? null,
    myHole:
      hand && mySeat ? (hand.hole_cards[String(mySeat.seat_index)] ?? null) : null,
    seats: seats.map((s) => ({
      seatIndex: s.seat_index,
      userId: s.user_id,
      isBot: s.is_bot,
      displayName: s.display_name,
      stack: s.stack,
      currentBet: s.current_bet,
      folded: s.folded,
      allIn: s.all_in,
      inHand: s.in_hand,
      lastAction: s.last_action,
      shownCards: showdown ? s.shown_cards : null,
      isMe: s.user_id === userId,
    })),
    hand: hand
      ? {
          handNo: hand.hand_no,
          stage: hand.stage,
          board: hand.board,
          pot: Math.max(
            hand.pot,
            seats.reduce((sum, s) => sum + s.total_committed, 0),
          ),
          dealerSeat: hand.dealer_seat,
          actingSeat: hand.acting_seat,
          currentBet: hand.current_bet,
          minRaise: hand.min_raise,
          deadline: hand.action_deadline,
          status: hand.status,
          resultText: hand.result_text,
        }
      : null,
  };
}
