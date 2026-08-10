// Client-safe credit constants shared by UI and server.

export const CREDIT_COSTS = {
  quick_scan: 1,
  photo_scan: 2,
  document_scan: 1,
  enrich: 1,
  analyze_further: 5,
  /** Deep analysis started from a live video-mode box — half price. */
  analyze_further_live: 2,
  /** Deep analysis of a scanned document — text-only, so it stays cheap. */
  analyze_further_document: 1,
  translate: 1,
  resale_listing: 1,
  /** One question in the in-item Ask AI chat. */
  ask_ai: 1,
} as const;

export type CreditReason = keyof typeof CREDIT_COSTS;

export const CREDIT_LABELS: Record<CreditReason, string> = {
  quick_scan: "Live scan frame",
  photo_scan: "Photo scan",
  document_scan: "Document scan",
  enrich: "Item details",
  analyze_further: "Analyze further",
  analyze_further_live: "Analyze further (live scan)",
  analyze_further_document: "Analyze further (document)",
  translate: "Translate",
  resale_listing: "Resale listing",
  ask_ai: "Ask AI question",
};



export const SIGNUP_GRANT = 10;


export const INSUFFICIENT_CREDITS = "insufficient_credits";

export function isInsufficientCreditsError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.toLowerCase().includes(INSUFFICIENT_CREDITS)
  );
}

export function readAnonCredits(): number {
  return 0;
}

export function writeAnonCredits(_value: number) {
  // No-op: anonymous users do not receive free trial credits.
}

