import { Link } from "@tanstack/react-router";
import { Coins, X } from "lucide-react";
import { CREDIT_COSTS, CREDIT_LABELS, DAILY_FLOOR, type CreditReason } from "@/lib/credits";
import type { CreditsApi } from "@/hooks/useCredits";

function reasonLabel(reason: string) {
  const base = reason.replace(/^refund:/, "");
  return CREDIT_LABELS[base as CreditReason] ?? base.replace(/_/g, " ");
}

export function CreditsSheet({ credits, onClose }: { credits: CreditsApi; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        className="gold-line max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="gold-text text-xl font-bold">Scan credits</h2>
            <p className="text-xs text-muted-foreground">
              {credits.signedIn
                ? (credits.email ?? "Signed in")
                : "Free trial — sign in to keep your balance"}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 flex items-center gap-2 text-3xl font-bold text-primary">
          <Coins className="h-7 w-7" />
          <span className="tabular-nums">{credits.balance}</span>
        </div>

        {credits.signedIn ? (
          <p className="mb-5 text-xs text-muted-foreground">
            Your balance tops back up to {DAILY_FLOOR} credits once a day.
          </p>
        ) : (
          <Link
            to="/auth"
            className="mb-5 block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground"
          >
            Sign in for {DAILY_FLOOR}+ credits a day
          </Link>
        )}

        <h3 className="mb-2 text-sm font-semibold">What each action costs</h3>
        <ul className="mb-5 space-y-1.5 text-sm">
          {(Object.keys(CREDIT_COSTS) as CreditReason[]).map((key) => (
            <li key={key} className="flex justify-between border-b border-border/40 pb-1.5">
              <span className="text-muted-foreground">{CREDIT_LABELS[key]}</span>
              <span className="tabular-nums text-primary">{CREDIT_COSTS[key]}</span>
            </li>
          ))}
        </ul>

        {credits.signedIn && credits.ledger.length > 0 && (
          <>
            <h3 className="mb-2 text-sm font-semibold">Recent activity</h3>
            <ul className="space-y-1 text-xs">
              {credits.ledger.map((entry) => (
                <li key={entry.id} className="flex justify-between text-muted-foreground">
                  <span>{reasonLabel(entry.reason)}</span>
                  <span className={entry.delta > 0 ? "text-primary" : ""}>
                    {entry.delta > 0 ? "+" : ""}
                    {entry.delta}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
