import { useState } from "react";
import { Loader2, Play, X } from "lucide-react";
import { toast } from "sonner";
import { claimAdReward } from "@/lib/ad-reward.functions";
import { adsAvailable, showRewardedAd } from "@/lib/admob";

export function AdRewardModal({
  onClose,
  onRewarded,
}: {
  onClose: () => void;
  onRewarded: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function watchAndClaim() {
    if (busy || done) return;
    setBusy(true);
    try {
      const earned = await showRewardedAd();
      if (!earned) {
        toast.error("Ad closed early — no credits added.");
        return;
      }
      const result = await claimAdReward();
      if (result.status === "limit_reached") {
        toast.error(`Daily limit reached — ${result.dailyLimit} ads per day.`);
      } else {
        toast.success("+2 credits added — thanks for watching!");
        setDone(true);
      }
      onRewarded();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No ad available right now. Try again soon.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4">
      <div className="gold-glow w-full max-w-sm rounded-2xl border-2 border-primary/70 bg-card p-5 text-foreground">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-primary">Watch an ad for 2 credits</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex aspect-video items-center justify-center rounded-xl border border-border bg-secondary/40">
          <div className="px-4 text-center">
            <Play className="mx-auto mb-2 h-8 w-8 text-primary" />
            <p className="text-sm text-muted-foreground">
              {adsAvailable()
                ? "Watch the full video to earn 2 credits."
                : "Rewarded ads are only available in the Scanything Android app."}
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={busy || done || !adsAvailable()}
          onClick={watchAndClaim}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {busy ? "Loading ad…" : "Watch ad"}
        </button>

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Up to 5 rewarded ads per day.
        </p>
      </div>
    </div>
  );
}
