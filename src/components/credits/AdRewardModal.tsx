import { useEffect, useState } from "react";
import { Loader2, Play, X } from "lucide-react";
import { toast } from "sonner";
import { claimAdReward } from "@/lib/ad-reward.functions";

const AD_SECONDS = 15;

export function AdRewardModal({
  onClose,
  onRewarded,
}: {
  onClose: () => void;
  onRewarded: () => void;
}) {
  const [remaining, setRemaining] = useState(AD_SECONDS);
  const [claiming, setClaiming] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  async function claim() {
    setClaiming(true);
    try {
      const result = await claimAdReward();
      if (result.status === "limit_reached") {
        toast.error(`Daily limit reached — ${result.dailyLimit} commercials per day.`);
      } else {
        toast.success("+1 credit added — thanks for watching!");
        setDone(true);
      }
      onRewarded();
      onClose();
    } catch {
      toast.error("Could not add your reward. Try again.");
    } finally {
      setClaiming(false);
    }
  }

  const progress = ((AD_SECONDS - remaining) / AD_SECONDS) * 100;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
      <div className="gold-glow w-full max-w-sm rounded-2xl border-2 border-primary/70 bg-card p-5 text-foreground">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-primary">Watch a commercial</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex aspect-video items-center justify-center rounded-xl border border-border bg-secondary/40">
          {remaining > 0 ? (
            <div className="text-center">
              <Play className="mx-auto mb-2 h-8 w-8 text-primary" />
              <p className="text-sm text-muted-foreground">Ad playing…</p>
              <p className="text-2xl font-bold tabular-nums text-primary">{remaining}s</p>
            </div>
          ) : (
            <p className="text-sm font-semibold text-primary">Ad finished</p>
          )}
        </div>

        <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <button
          type="button"
          disabled={remaining > 0 || claiming || done}
          onClick={claim}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {remaining > 0 ? `Claim 1 credit in ${remaining}s` : "Claim 1 credit"}
        </button>

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Up to 5 rewarded commercials per day.
        </p>
      </div>
    </div>
  );
}
