import { useState } from "react";
import { Clapperboard } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { adsAvailable } from "@/lib/admob";
import { AdRewardModal } from "@/components/credits/AdRewardModal";

/**
 * Shared "Watch an ad for 2 credits" entry point.
 * Renders nothing outside the Android app or when signed out.
 * The 5 ads/day cap is enforced server-side, so every instance stays in sync.
 */
export function WatchAdButton({
  signedIn,
  variant = "full",
  onRewarded,
}: {
  signedIn: boolean;
  variant?: "full" | "icon";
  onRewarded?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  if (!signedIn || !adsAvailable()) return null;

  function handleRewarded() {
    void queryClient.invalidateQueries({ queryKey: ["credits"] });
    onRewarded?.();
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Watch an ad for 2 credits"
          title="Watch an ad for 2 credits"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/40 bg-card text-primary gold-glow transition-colors hover:bg-primary/10"
        >
          <Clapperboard className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary/60 px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          <Clapperboard className="h-4 w-4" />
          Watch an ad for 2 credits
        </button>
      )}

      {open && (
        <div onClick={(e) => e.stopPropagation()}>
          <AdRewardModal onClose={() => setOpen(false)} onRewarded={handleRewarded} />
        </div>
      )}
    </>
  );
}
