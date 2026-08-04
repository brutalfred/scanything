// Client-safe credit constants shared by UI and server.

export const CREDIT_COSTS = {
  quick_scan: 1,
  photo_scan: 2,
  document_scan: 1,
  enrich: 1,
  analyze_further: 5,
  /** Deep analysis started from a live video-mode box — half price. */
  analyze_further_live: 2,
  translate: 1,
  person_info: 3,
} as const;

export type CreditReason = keyof typeof CREDIT_COSTS;

export const CREDIT_LABELS: Record<CreditReason, string> = {
  quick_scan: "Live scan frame",
  photo_scan: "Photo scan",
  document_scan: "Document scan",
  enrich: "Item details",
  analyze_further: "Analyze further",
  analyze_further_live: "Analyze further (live scan)",
  translate: "Translate",
  person_info: "Person lookup",
};


export const SIGNUP_GRANT = 5;

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

