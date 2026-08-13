/** Shared, browser-safe poker types and card helpers. */

export const SUITS = ["s", "h", "d", "c"] as const;
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;

export const SUIT_SYMBOL: Record<string, string> = { s: "♠", h: "♥", d: "♦", c: "♣" };

/** Cards are ints 0-51: rank = card % 13 (0 = deuce), suit = floor(card / 13). */
export function cardRank(card: number) {
  return card % 13;
}
export function cardSuit(card: number) {
  return SUITS[Math.floor(card / 13)]!;
}
export function cardLabel(card: number) {
  return `${RANKS[cardRank(card)]}${SUIT_SYMBOL[cardSuit(card)]}`;
}
export function isRedCard(card: number) {
  const s = cardSuit(card);
  return s === "h" || s === "d";
}

export const HAND_CATEGORIES = [
  "High card",
  "Pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
] as const;

export type PokerStage = "preflop" | "flop" | "turn" | "river" | "showdown";
export type PokerAction = "fold" | "check" | "call" | "raise" | "allin";

export type SeatView = {
  seatIndex: number;
  userId: string | null;
  isBot: boolean;
  displayName: string;
  stack: number;
  currentBet: number;
  folded: boolean;
  allIn: boolean;
  inHand: boolean;
  lastAction: string | null;
  shownCards: number[] | null;
  isMe: boolean;
};

export type TableView = {
  id: string;
  name: string;
  status: "waiting" | "playing" | "finished";
  maxSeats: number;
  smallBlind: number;
  bigBlind: number;
  isPrivate: boolean;
  hostId: string;
  seats: SeatView[];
  hand: {
    handNo: number;
    stage: PokerStage;
    board: number[];
    pot: number;
    dealerSeat: number;
    actingSeat: number | null;
    currentBet: number;
    minRaise: number;
    deadline: string | null;
    status: "active" | "complete";
    resultText: string | null;
  } | null;
  myHole: number[] | null;
  mySeat: number | null;
  chips: number;
};

export type TableSummary = {
  id: string;
  name: string;
  status: string;
  seated: number;
  maxSeats: number;
  smallBlind: number;
  bigBlind: number;
};

export const STARTING_CHIPS = 5000;
export const REBUY_CHIPS = 1000;
export const TURN_SECONDS = 25;
