import { Loader2 } from "lucide-react";
import { usePiPacks, usePiPayments } from "@/hooks/usePiPayments";

/** Buy credit packs with Pi — only rendered inside the Pi Browser. */
export function PiCreditPacks({ signedIn }: { signedIn: boolean }) {
  const { available, busyPackId, buy } = usePiPayments();
  const packs = usePiPacks(available);

  if (!available) return null;

  return (
    <div className="mb-5 rounded-xl border-2 border-primary/40 bg-primary/5 p-3">
      <h4 className="mb-1 text-sm font-semibold text-primary">Pay with Pi</h4>
      <p className="mb-2 text-[11px] text-muted-foreground">
        {packs.data
          ? `Prices follow the Pi market rate (1 π ≈ $${packs.data.usdPerPi.toFixed(3)}), updated daily.`
          : "Loading today's Pi rate…"}
      </p>

      {!signedIn && (
        <p className="text-xs text-muted-foreground">
          Sign in with Pi first to buy credits.
        </p>
      )}

      {signedIn && (
        <div className="grid grid-cols-2 gap-2">
          {(packs.data?.packs ?? []).map((pack) => (
            <button
              key={pack.packId}
              type="button"
              disabled={busyPackId !== null}
              onClick={() => void buy(pack)}
              className="rounded-lg border border-primary/50 bg-background/40 p-2.5 text-left transition-colors hover:border-primary disabled:opacity-60"
            >
              <div className="text-base font-bold text-foreground">{pack.pi} π</div>
              <div className="text-sm font-semibold tabular-nums text-foreground">
                {busyPackId === pack.packId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `${pack.credits} credits`
                )}
              </div>
              <div className="text-[11px] text-muted-foreground">≈ ${pack.usd}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
