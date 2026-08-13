/** Server-only Texas Hold'em engine: deck, hand evaluation, betting, bots. */
import { HAND_CATEGORIES, RANKS, TURN_SECONDS } from "./poker";

export type SeatRow = {
  id: string;
  seat_index: number;
  user_id: string | null;
  is_bot: boolean;
  display_name: string;
  stack: number;
  current_bet: number;
  total_committed: number;
  folded: boolean;
  all_in: boolean;
  has_acted: boolean;
  in_hand: boolean;
  last_action: string | null;
  shown_cards: number[] | null;
};

export type HandRow = {
  id: string;
  table_id: string;
  hand_no: number;
  deck: number[];
  hole_cards: Record<string, number[]>;
  board: number[];
  pot: number;
  stage: "preflop" | "flop" | "turn" | "river" | "showdown";
  dealer_seat: number;
  acting_seat: number | null;
  current_bet: number;
  min_raise: number;
  action_deadline: string | null;
  status: "active" | "complete";
  result_text: string | null;
  winners: number[];
  updated_at?: string;
};

export type TableRow = {
  id: string;
  name: string;
  host_id: string;
  status: string;
  max_seats: number;
  small_blind: number;
  big_blind: number;
  is_private: boolean;
  version: number;
};

export type GameState = { table: TableRow; seats: SeatRow[]; hand: HandRow };

/* ---------------------------------- deck --------------------------------- */

export function shuffledDeck(): number[] {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

/* -------------------------------- evaluator ------------------------------- */

/** Scores exactly five cards. Higher is better. */
function score5(cards: number[]): number {
  const ranks = cards.map((c) => c % 13).sort((a, b) => b - a);
  const suits = cards.map((c) => Math.floor(c / 13));
  const flush = suits.every((s) => s === suits[0]);

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  let straightHigh = -1;
  if (unique.length === 5) {
    if (unique[0]! - unique[4]! === 4) straightHigh = unique[0]!;
    // wheel: A-5-4-3-2
    else if (unique[0] === 12 && unique[1] === 3 && unique[4] === 0) straightHigh = 3;
  }

  let category: number;
  if (flush && straightHigh >= 0) category = 8;
  else if (groups[0]![1] === 4) category = 7;
  else if (groups[0]![1] === 3 && groups[1]![1] === 2) category = 6;
  else if (flush) category = 5;
  else if (straightHigh >= 0) category = 4;
  else if (groups[0]![1] === 3) category = 3;
  else if (groups[0]![1] === 2 && groups[1]![1] === 2) category = 2;
  else if (groups[0]![1] === 2) category = 1;
  else category = 0;

  const kickers =
    category === 4 || category === 8
      ? [straightHigh, 0, 0, 0, 0]
      : groups.flatMap(([r, n]) => Array.from({ length: n }, () => r)).slice(0, 5);

  let score = category;
  for (let i = 0; i < 5; i++) score = score * 16 + ((kickers[i] ?? 0) + 1);
  return score;
}

const COMBOS_7_5 = (() => {
  const out: number[][] = [];
  for (let a = 0; a < 7; a++)
    for (let b = a + 1; b < 7; b++)
      for (let c = b + 1; c < 7; c++)
        for (let d = c + 1; d < 7; d++)
          for (let e = d + 1; e < 7; e++) out.push([a, b, c, d, e]);
  return out;
})();

export function evaluate(cards: number[]): { score: number; label: string } {
  let best = -1;
  let bestCards: number[] = [];
  if (cards.length <= 5) {
    best = score5(cards.length === 5 ? cards : padTo5(cards));
    bestCards = cards;
  } else {
    for (const combo of COMBOS_7_5) {
      if (combo.some((i) => i >= cards.length)) continue;
      const picked = combo.map((i) => cards[i]!);
      const s = score5(picked);
      if (s > best) {
        best = s;
        bestCards = picked;
      }
    }
  }
  const category = Math.floor(best / 16 ** 5);
  const high = bestCards.length ? Math.max(...bestCards.map((c) => c % 13)) : 0;
  return { score: best, label: `${HAND_CATEGORIES[category]}, ${RANKS[high]} high` };
}

function padTo5(cards: number[]): number[] {
  return [...cards, ...Array.from({ length: 5 - cards.length }, (_, i) => 51 - i)];
}

/* ------------------------------ seat helpers ------------------------------ */

const byIndex = (seats: SeatRow[]) => [...seats].sort((a, b) => a.seat_index - b.seat_index);

function occupied(seat: SeatRow) {
  return Boolean(seat.user_id) || seat.is_bot;
}

function nextSeat(seats: SeatRow[], from: number, match: (s: SeatRow) => boolean): number | null {
  const ordered = byIndex(seats);
  for (let step = 1; step <= ordered.length; step++) {
    const idx = (from + step) % Math.max(1, maxIndex(ordered) + 1);
    const seat = ordered.find((s) => s.seat_index === idx);
    if (seat && match(seat)) return seat.seat_index;
  }
  return null;
}

function maxIndex(seats: SeatRow[]) {
  return seats.reduce((m, s) => Math.max(m, s.seat_index), 0);
}

const canAct = (s: SeatRow) => s.in_hand && !s.folded && !s.all_in;
const live = (s: SeatRow) => s.in_hand && !s.folded;

/* -------------------------------- hand start ------------------------------ */

export function buildNewHand(
  table: TableRow,
  seats: SeatRow[],
  handNo: number,
  prevDealer: number,
): { hand: Omit<HandRow, "id" | "table_id">; seats: SeatRow[] } {
  const players = byIndex(seats).filter((s) => occupied(s) && s.stack > 0);
  const deck = shuffledDeck();

  for (const s of seats) {
    s.current_bet = 0;
    s.total_committed = 0;
    s.folded = false;
    s.all_in = false;
    s.has_acted = false;
    s.last_action = null;
    s.shown_cards = null;
    s.in_hand = players.some((p) => p.seat_index === s.seat_index);
  }

  const dealer =
    nextSeat(seats, prevDealer, (s) => s.in_hand) ?? players[0]?.seat_index ?? 0;

  const heads = players.length === 2;
  const sbSeat = heads ? dealer : (nextSeat(seats, dealer, (s) => s.in_hand) ?? dealer);
  const bbSeat = nextSeat(seats, sbSeat, (s) => s.in_hand) ?? sbSeat;

  const hole: Record<string, number[]> = {};
  for (const p of players) hole[String(p.seat_index)] = [deck.pop()!, deck.pop()!];

  const post = (seatIndex: number, amount: number) => {
    const seat = seats.find((s) => s.seat_index === seatIndex)!;
    const paid = Math.min(amount, seat.stack);
    seat.stack -= paid;
    seat.current_bet += paid;
    seat.total_committed += paid;
    if (seat.stack === 0) seat.all_in = true;
    return paid;
  };
  post(sbSeat, table.small_blind);
  post(bbSeat, table.big_blind);

  const acting = nextSeat(seats, bbSeat, canAct);

  return {
    seats,
    hand: {
      hand_no: handNo,
      deck,
      hole_cards: hole,
      board: [],
      pot: seats.reduce((sum, s) => sum + s.total_committed, 0),
      stage: "preflop",
      dealer_seat: dealer,
      acting_seat: acting,
      current_bet: table.big_blind,
      min_raise: table.big_blind,
      action_deadline: new Date(Date.now() + TURN_SECONDS * 1000).toISOString(),
      status: "active",
      result_text: null,
      winners: [],
    },
  };
}

/* --------------------------------- betting -------------------------------- */

export function legalActions(state: GameState, seatIndex: number) {
  const seat = state.seats.find((s) => s.seat_index === seatIndex);
  if (!seat) return null;
  const toCall = Math.max(0, state.hand.current_bet - seat.current_bet);
  const minRaiseTo = state.hand.current_bet + state.hand.min_raise;
  return {
    toCall: Math.min(toCall, seat.stack),
    canCheck: toCall === 0,
    minRaiseTo: Math.min(minRaiseTo, seat.current_bet + seat.stack),
    maxRaiseTo: seat.current_bet + seat.stack,
  };
}

export function applyAction(
  state: GameState,
  seatIndex: number,
  action: "fold" | "check" | "call" | "raise" | "allin",
  amount = 0,
) {
  const seat = state.seats.find((s) => s.seat_index === seatIndex);
  if (!seat || !canAct(seat)) throw new Error("not_your_turn");
  if (state.hand.acting_seat !== seatIndex) throw new Error("not_your_turn");

  const hand = state.hand;
  const toCall = Math.max(0, hand.current_bet - seat.current_bet);

  const pay = (n: number) => {
    const paid = Math.min(n, seat.stack);
    seat.stack -= paid;
    seat.current_bet += paid;
    seat.total_committed += paid;
    if (seat.stack === 0) seat.all_in = true;
  };

  if (action === "fold") {
    seat.folded = true;
    seat.last_action = "Fold";
  } else if (action === "check") {
    if (toCall > 0) throw new Error("cannot_check");
    seat.last_action = "Check";
  } else if (action === "call") {
    pay(toCall);
    seat.last_action = toCall === 0 ? "Check" : "Call";
  } else {
    // raise / all-in, `amount` is the total bet the seat wants to reach
    const target =
      action === "allin" ? seat.current_bet + seat.stack : Math.round(amount);
    const maxTo = seat.current_bet + seat.stack;
    const raiseTo = Math.min(Math.max(target, hand.current_bet + 1), maxTo);
    const isFullRaise = raiseTo >= hand.current_bet + hand.min_raise;
    if (!isFullRaise && raiseTo < maxTo) throw new Error("raise_too_small");
    pay(raiseTo - seat.current_bet);
    if (seat.current_bet > hand.current_bet) {
      if (isFullRaise) hand.min_raise = seat.current_bet - hand.current_bet;
      hand.current_bet = seat.current_bet;
      for (const other of state.seats) {
        if (other.seat_index !== seatIndex && canAct(other)) other.has_acted = false;
      }
    }
    seat.last_action = seat.all_in ? "All-in" : "Raise";
  }

  seat.has_acted = true;
  progress(state);
}

/** Advances the hand: closes betting rounds, deals streets, resolves showdown. */
export function progress(state: GameState) {
  const hand = state.hand;

  for (let guard = 0; guard < 8; guard++) {
    const liveSeats = state.seats.filter(live);
    if (liveSeats.length <= 1) {
      finishHand(state, liveSeats.map((s) => s.seat_index), null);
      return;
    }

    const pending = state.seats.filter(
      (s) => canAct(s) && (!s.has_acted || s.current_bet < hand.current_bet),
    );

    if (pending.length > 0) {
      const from = hand.acting_seat ?? hand.dealer_seat;
      const next =
        nextSeat(state.seats, from, (s) => pending.some((p) => p.seat_index === s.seat_index)) ??
        pending[0]!.seat_index;
      hand.acting_seat = next;
      hand.action_deadline = new Date(Date.now() + TURN_SECONDS * 1000).toISOString();
      return;
    }

    // betting round closed
    for (const s of state.seats) {
      s.current_bet = 0;
      s.has_acted = false;
    }
    hand.current_bet = 0;
    hand.min_raise = state.table.big_blind;
    hand.pot = state.seats.reduce((sum, s) => sum + s.total_committed, 0);

    if (hand.stage === "river") {
      showdown(state);
      return;
    }

    hand.stage =
      hand.stage === "preflop" ? "flop" : hand.stage === "flop" ? "turn" : "river";
    const draw = hand.stage === "flop" ? 3 : 1;
    for (let i = 0; i < draw; i++) hand.board.push(hand.deck.pop()!);

    const actors = state.seats.filter(canAct);
    if (actors.length <= 1) {
      // everyone is all-in: keep dealing streets, no more betting
      hand.acting_seat = null;
      continue;
    }
    hand.acting_seat = null;
    const first = nextSeat(state.seats, hand.dealer_seat, canAct);
    hand.acting_seat = first;
    hand.action_deadline = new Date(Date.now() + TURN_SECONDS * 1000).toISOString();
    return;
  }
  showdown(state);
}

function showdown(state: GameState) {
  const hand = state.hand;
  hand.stage = "showdown";
  const contenders = state.seats.filter(live);
  const scores = new Map<number, { score: number; label: string }>();
  for (const s of contenders) {
    const hole = hand.hole_cards[String(s.seat_index)] ?? [];
    s.shown_cards = hole;
    scores.set(s.seat_index, evaluate([...hole, ...hand.board]));
  }
  const winners = distributePots(state, scores);
  const bestLabel = scores.get(winners[0] ?? -1)?.label ?? "";
  const names = winners
    .map((i) => state.seats.find((s) => s.seat_index === i)?.display_name ?? "Player")
    .join(" & ");
  finishHand(state, winners, `${names} wins with ${bestLabel}`);
}

function distributePots(
  state: GameState,
  scores: Map<number, { score: number; label: string }>,
): number[] {
  const seats = state.seats.filter((s) => s.total_committed > 0 || s.in_hand);
  const levels = [...new Set(seats.map((s) => s.total_committed).filter((n) => n > 0))].sort(
    (a, b) => a - b,
  );
  const overallWinners = new Set<number>();
  let prev = 0;
  for (const level of levels) {
    let pot = 0;
    for (const s of seats) {
      pot += Math.min(s.total_committed, level) - Math.min(s.total_committed, prev);
    }
    const eligible = seats.filter(
      (s) => live(s) && s.total_committed >= level && scores.has(s.seat_index),
    );
    if (eligible.length && pot > 0) {
      const best = Math.max(...eligible.map((s) => scores.get(s.seat_index)!.score));
      const winners = eligible.filter((s) => scores.get(s.seat_index)!.score === best);
      const share = Math.floor(pot / winners.length);
      let remainder = pot - share * winners.length;
      for (const w of winners) {
        w.stack += share + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        overallWinners.add(w.seat_index);
      }
    }
    prev = level;
  }
  return [...overallWinners];
}

function finishHand(state: GameState, winners: number[], resultText: string | null) {
  const hand = state.hand;
  if (hand.status === "complete") return;
  if (!resultText) {
    // everyone else folded
    const pot = state.seats.reduce((sum, s) => sum + s.total_committed, 0);
    const winner = state.seats.find((s) => s.seat_index === winners[0]);
    if (winner) winner.stack += pot;
    hand.result_text = winner ? `${winner.display_name} wins ${pot} chips` : "Hand over";
  } else {
    hand.result_text = resultText;
  }
  hand.pot = state.seats.reduce((sum, s) => sum + s.total_committed, 0);
  hand.winners = winners;
  hand.status = "complete";
  hand.acting_seat = null;
  hand.action_deadline = null;
  for (const s of state.seats) s.current_bet = 0;
}

/* ---------------------------------- bots ---------------------------------- */

function handStrength(hole: number[], board: number[]): number {
  if (board.length === 0) {
    const [a, b] = [hole[0]!, hole[1]!];
    const ra = a % 13;
    const rb = b % 13;
    const pair = ra === rb;
    const suited = Math.floor(a / 13) === Math.floor(b / 13);
    const high = Math.max(ra, rb) / 12;
    const gap = Math.abs(ra - rb);
    let s = high * 0.45 + (pair ? 0.42 : 0) + (suited ? 0.08 : 0);
    if (!pair && gap <= 2) s += 0.06;
    return Math.min(0.97, s);
  }
  const { score } = evaluate([...hole, ...board]);
  const category = Math.floor(score / 16 ** 5);
  const high = (score % 16 ** 5) / 16 ** 5;
  return Math.min(0.99, category / 8 + high * 0.1);
}

export function botAction(state: GameState, seatIndex: number) {
  const seat = state.seats.find((s) => s.seat_index === seatIndex)!;
  const hole = state.hand.hole_cards[String(seatIndex)] ?? [];
  const strength = handStrength(hole, state.hand.board);
  const info = legalActions(state, seatIndex)!;
  const pot = Math.max(1, state.seats.reduce((sum, s) => sum + s.total_committed, 0));
  const roll = Math.random();

  if (info.toCall === 0) {
    if (strength > 0.58 && roll < 0.6) {
      const bet = Math.min(info.maxRaiseTo, Math.max(info.minRaiseTo, Math.round(pot * 0.55)));
      applyAction(state, seatIndex, "raise", bet);
      return;
    }
    if (roll > 0.94) {
      const bet = Math.min(info.maxRaiseTo, Math.max(info.minRaiseTo, Math.round(pot * 0.4)));
      applyAction(state, seatIndex, "raise", bet);
      return;
    }
    applyAction(state, seatIndex, "check");
    return;
  }

  const odds = info.toCall / (pot + info.toCall);
  if (strength > 0.78 && roll < 0.45 && info.maxRaiseTo > info.minRaiseTo) {
    const bet = Math.min(info.maxRaiseTo, Math.max(info.minRaiseTo, Math.round(pot * 0.75)));
    applyAction(state, seatIndex, "raise", bet);
    return;
  }
  if (strength > odds + 0.08 || (roll > 0.93 && info.toCall <= seat.stack * 0.25)) {
    applyAction(state, seatIndex, "call");
    return;
  }
  applyAction(state, seatIndex, info.toCall === 0 ? "check" : "fold");
}

export const BOT_NAMES = ["Ace Bot", "Chip Bot", "River Bot", "Bluff Bot", "Nova Bot"];
