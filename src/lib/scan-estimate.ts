import { CREDIT_COSTS } from "./credits";

/**
 * Rolling estimate of what a scan actually costs the user.
 *
 * The base scan price is fixed, but a real scan session often costs more
 * (extra "Load more" passes). We keep the last few real totals per mode in
 * localStorage and average them so the button can show an honest estimate.
 */

export type ScanMode = "photo" | "document";

const KEY = "scanything:scan-cost-history";
const MAX_SAMPLES = 5;

type History = Partial<Record<ScanMode, number[]>>;

export function baseScanCost(mode: ScanMode): number {
  return mode === "document" ? CREDIT_COSTS.document_scan : CREDIT_COSTS.photo_scan;
}

function read(): History {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as History) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Records what a finished scan session really cost, in credits. */
export function recordScanCost(mode: ScanMode, cost: number) {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(cost) || cost <= 0) return;
  const history = read();
  const samples = [...(history[mode] ?? []), Math.round(cost)].slice(-MAX_SAMPLES);
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...history, [mode]: samples }));
  } catch {
    /* storage full — estimates simply stay at the base price */
  }
}

/**
 * Estimated credits for the next scan in this mode: the average of recent real
 * totals, never below the base price. `learned` is false until we have data.
 */
export function estimateScanCost(mode: ScanMode): { credits: number; learned: boolean } {
  const base = baseScanCost(mode);
  const samples = read()[mode] ?? [];
  if (!samples.length) return { credits: base, learned: false };
  const avg = samples.reduce((sum, n) => sum + n, 0) / samples.length;
  return { credits: Math.max(base, Math.round(avg)), learned: true };
}
