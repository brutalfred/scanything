// Client-safe credit constants shared by UI and server.

export const CREDIT_COSTS = {
  quick_scan: 1,
  photo_scan: 2,
  enrich: 1,
  analyze_further: 5,
  translate: 1,
  person_info: 3,
} as const;

export type CreditReason = keyof typeof CREDIT_COSTS;

export const CREDIT_LABELS: Record<CreditReason, string> = {
  quick_scan: "Live scan frame",
  photo_scan: "Photo scan",
  enrich: "Item details",
  analyze_further: "Analyze further",
  translate: "Translate",
  person_info: "Person lookup",
};

export const SIGNUP_GRANT = 100;
export const DAILY_FLOOR = 25;

/** Free trial allowance for visitors who have not signed in yet. */
export const ANON_TRIAL_CREDITS = 40;
export const ANON_STORAGE_KEY = "scanything:trialCredits";

export const INSUFFICIENT_CREDITS = "insufficient_credits";

export function isInsufficientCreditsError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.toLowerCase().includes(INSUFFICIENT_CREDITS)
  );
}

export function readAnonCredits(): number {
  if (typeof window === "undefined") return ANON_TRIAL_CREDITS;
  const raw = window.localStorage.getItem(ANON_STORAGE_KEY);
  if (raw === null) return ANON_TRIAL_CREDITS;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : ANON_TRIAL_CREDITS;
}

export function writeAnonCredits(value: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ANON_STORAGE_KEY, String(Math.max(0, Math.floor(value))));
}
