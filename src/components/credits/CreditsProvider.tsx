import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { toast } from "sonner";
import { useCredits, type CreditsApi } from "@/hooks/useCredits";
import { CreditsSheet } from "./CreditsSheet";
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

  const openSheet = useCallback(() => setOpen(true), []);

  const spend = useCallback(
    (reason: CreditReason, opts?: { silent?: boolean }) => {
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
      {children}
      {open && <CreditsSheet credits={credits} onClose={() => setOpen(false)} />}
    </Ctx.Provider>
  );
}
