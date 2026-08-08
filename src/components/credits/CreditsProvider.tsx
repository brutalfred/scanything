import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useCredits, type CreditsApi } from "@/hooks/useCredits";
import { CreditsSheet } from "./CreditsSheet";
import { WelcomeInfoModal } from "@/components/WelcomeInfoModal";
import { CREDIT_LABELS, type CreditReason } from "@/lib/credits";


type CreditsContextValue = CreditsApi & {
  /** Reserve credits for an action. Returns false (and nudges the user) when the balance is short. */
  spend: (reason: CreditReason, opts?: { silent?: boolean }) => boolean;
  openSheet: () => void;
};

const Ctx = createContext<CreditsContextValue | null>(null);

export function useCreditsContext() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCreditsContext must be used inside <CreditsProvider>");
  return ctx;
}

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const credits = useCredits();
  const [open, setOpen] = useState(false);

  // Arcade coin only for reward moments (top-up, daily check-in, commercial),
  // which each trigger the sound at their own call site. Web checkout returns
  // here with ?checkout=success, so that top-up is handled below.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success") return;
    params.delete("checkout");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);


  const openSheet = useCallback(() => setOpen(true), []);


  const spend = useCallback(
    (reason: CreditReason, opts?: { silent?: boolean }) => {
      // One free photo/resale scan per day — no credits required or debited.
      if (reason === "photo_scan" && credits.freeScanAvailable) {
        setTimeout(() => credits.refresh(), 1200);
        return true;
      }
      if (!credits.canAfford(reason)) {
        if (!opts?.silent) {
          toast.error(`Out of credits for ${CREDIT_LABELS[reason].toLowerCase()}`);
          setOpen(true);
        }
        return false;
      }
      credits.noteSpend(reason);
      return true;
    },
    [credits],
  );

  const value = useMemo<CreditsContextValue>(
    () => ({ ...credits, spend, openSheet }),
    [credits, spend, openSheet],
  );

  return (
    <Ctx.Provider value={value}>
      {credits.trialNotice && (
        <div className="sticky top-0 z-50 border-b border-primary/40 bg-card px-4 py-3">
          <div className="mx-auto flex max-w-4xl items-start gap-3">
            <p className="flex-1 text-xs text-foreground">{credits.trialNotice}</p>
            <button
              type="button"
              onClick={openSheet}
              className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
            >
              Get credits
            </button>
            <button
              type="button"
              onClick={credits.dismissTrialNotice}
              aria-label="Dismiss"
              className="px-1 text-xs text-muted-foreground"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {children}
      <WelcomeInfoModal signedIn={credits.signedIn} userId={credits.userId} />
      {open && <CreditsSheet credits={credits} onClose={() => setOpen(false)} />}
    </Ctx.Provider>
  );
}
