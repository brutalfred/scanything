import { useEffect, useRef, useState } from "react";
import { Play, X } from "lucide-react";
import { AD_REWARD_CREDITS } from "@/lib/credit-packs";

const AD_SECONDS = 15;

/**
 * Placeholder rewarded-ad player. Swap the inner panel for a real ad-network
 * embed later — the reward is only granted once `onFinished` fires.
 */
export function AdRewardModal({
  onFinished,
  onClose,
}: {
  onFinished: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [remaining, setRemaining] = useState(AD_SECONDS);
  const [claiming, setClaiming] = useState(false);
  const claimed = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const done = remaining === 0;

  async function claim() {
    if (claimed.current) return;
    claimed.current = true;
    setClaiming(true);
    try {
      await onFinished();
      onClose();
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-neutral-100 text-neutral-900">
        <div className="flex items-center justify-between px-4 py-2 text-xs font-semibold text-neutral-600">
          <span>Advertisement</span>
          {done ? (
            <button onClick={onClose} aria-label="Close advert">
              <X className="h-4 w-4" />
            </button>
          ) : (
            <span className="tabular-nums">Reward in {remaining}s</span>
          )}
        </div>

        <div className="relative flex aspect-video items-center justify-center bg-neutral-900">
          <div className="text-center text-neutral-100">
            <Play className="mx-auto mb-2 h-10 w-10 opacity-60" />
            <p className="text-sm opacity-70">Your ad plays here</p>
          </div>
          <div className="absolute bottom-0 left-0 h-1 bg-primary transition-all duration-1000"
            style={{ width: `${((AD_SECONDS - remaining) / AD_SECONDS) * 100}%` }}
          />
        </div>

        <div className="p-4">
          <button
            type="button"
            disabled={!done || claiming}
            onClick={claim}
            className="w-full rounded-lg bg-neutral-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            {claiming
              ? "Adding credits…"
              : done
                ? `Collect ${AD_REWARD_CREDITS} credits (1 photo scan)`
                : `Watch ${remaining}s to earn ${AD_REWARD_CREDITS} credits`}
          </button>
        </div>
      </div>
    </div>
  );
}
