import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAdRewardStatus } from "@/lib/ad-reward.functions";
import { Link } from "@tanstack/react-router";
import { Coins, Loader2, Play, X } from "lucide-react";
import { playSound } from "@/lib/sounds";

import { toast } from "sonner";
import { CREDIT_COSTS, CREDIT_LABELS, type CreditReason } from "@/lib/credits";
import { CREDIT_PACKS } from "@/lib/credit-packs";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { getPaddleEnvironment } from "@/lib/paddle";
import { AdRewardModal } from "./AdRewardModal";
import { isNativeAndroid } from "@/lib/platform";
import { buyWithPlay, playBillingAvailable } from "@/lib/play-billing";
import type { CreditsApi } from "@/hooks/useCredits";


/** Web price IDs mapped to Google Play in-app product IDs. */
const PLAY_PRODUCT_BY_PRICE_ID: Record<string, string> = {
  credits_pack_1_price: "credits_1",
  credits_pack_5_price: "credits_5",
  credits_pack_10_price: "credits_10",
  credits_pack_50_price: "credits_50",
};

function reasonLabel(reason: string) {
  const base = reason.replace(/^refund:/, "").replace(/^purchase:.*$/, "purchase");
  if (base === "purchase") return "Credit top-up";
  return CREDIT_LABELS[base as CreditReason] ?? base.replace(/_/g, " ");
}

export function CreditsSheet({ credits, onClose }: { credits: CreditsApi; onClose: () => void }) {
  const { openCheckout } = usePaddleCheckout();
  const [buying, setBuying] = useState<string | null>(null);
  const [adOpen, setAdOpen] = useState(false);
  const adStatus = useQuery({
    queryKey: ["ad-reward-status"],
    queryFn: () => getAdRewardStatus(),
    enabled: credits.signedIn,
    staleTime: 10_000,
  });
  const adsWatched = adStatus.data?.claimsToday ?? 0;
  const adLimit = adStatus.data?.dailyLimit ?? 5;
  const adLimitReached = credits.signedIn && adsWatched >= adLimit;



  async function buy(priceId: string) {
    if (!credits.signedIn || !credits.userId) {
      toast.error("Sign in first so your credits are saved to your account");
      return;
    }
    setBuying(priceId);
    try {
      if (isNativeAndroid()) {
        if (!playBillingAvailable()) {
          throw new Error("Google Play billing is unavailable on this device");
        }
        // Play requires in-app purchases for digital goods inside the Android app.
        const productId = PLAY_PRODUCT_BY_PRICE_ID[priceId];
        if (!productId) throw new Error("This pack is not available in the app");
        await buyWithPlay(productId);
        await credits.refresh?.();
        void playSound("coin");
        toast.success("Credits added to your account");
        return;

      }
      await openCheckout({
        priceId,
        customerEmail: credits.email ?? undefined,
        customData: { userId: credits.userId },
        successUrl: `${window.location.origin}/?checkout=success`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open checkout");
    } finally {
      setBuying(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        className="gold-glow max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border-2 border-primary/70 bg-card p-5 text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-primary">Scan credits</h2>
            <p className="text-xs text-muted-foreground">
              {credits.signedIn
                ? (credits.email ?? "Signed in")
                : "Sign in to start scanning and keep your balance"}
            </p>
          </div>

          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-5 flex items-center gap-2 text-3xl font-bold text-primary">
          <Coins className="h-7 w-7" />
          <span className="tabular-nums">{credits.balance}</span>
        </div>

        {!credits.signedIn && (
          <Link
            to="/auth"
            className="mb-5 block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground"
          >
            Sign in to buy credits and keep your balance
          </Link>
        )}

        <h3 className="mb-2 text-sm font-semibold text-primary">Top up</h3>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.priceId}
              type="button"
              disabled={buying !== null}
              onClick={() => buy(pack.priceId)}
              className={`relative rounded-xl border-2 p-3 text-left transition-colors disabled:opacity-60 ${
                pack.best
                  ? "border-primary bg-primary/10"
                  : "border-border bg-secondary/40 hover:border-primary/40"
              }`}
            >
              {pack.best && (
                <span className="absolute right-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                  Best
                </span>
              )}
              <div className="text-lg font-bold text-foreground">{pack.priceLabel}</div>
              <div className="text-sm font-semibold tabular-nums text-foreground">
                {buying === pack.priceId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  `${pack.credits} credits`
                )}
              </div>
              <div className="text-xs text-muted-foreground">≈ {pack.photoScans} photo scans</div>
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!credits.signedIn || adLimitReached}
          onClick={() => {
            if (!credits.signedIn || adLimitReached) return;
            setAdOpen(true);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-primary/60 bg-secondary/40 px-4 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          {adLimitReached ? "Daily commercial limit reached" : "Watch a commercial for 1 credit"}
        </button>
        {credits.signedIn && (
          <p className="mb-4 mt-1.5 text-center text-[11px] text-muted-foreground">
            {adsWatched}/{adLimit} commercials watched today
          </p>
        )}
        {!credits.signedIn && <div className="mb-4" />}




        <div className="mb-5 text-right">
          <Link
            to="/pricing"
            className="text-xs font-medium text-primary underline hover:text-primary/80"
          >
            View full pricing page
          </Link>
        </div>

        {credits.signedIn && (
          <p className="mb-5 text-xs text-muted-foreground">
            Credits never expire. Top up any time.
          </p>
        )}

        <h3 className="mb-2 text-sm font-semibold text-primary">What each action costs</h3>
        <ul className="mb-5 space-y-1.5 text-sm">
          {(Object.keys(CREDIT_COSTS) as CreditReason[]).map((key) => (
            <li key={key} className="flex justify-between border-b border-border pb-1.5">
              <span className="text-muted-foreground">{CREDIT_LABELS[key]}</span>
              <span className="font-semibold tabular-nums text-foreground">{CREDIT_COSTS[key]}</span>
            </li>
          ))}
        </ul>

        {credits.signedIn && credits.ledger.length > 0 && (
          <>
            <h3 className="mb-2 text-sm font-semibold text-primary">Recent activity</h3>
            <ul className="space-y-1 text-xs">
              {credits.ledger.map((entry) => (
                <li key={entry.id} className="flex justify-between text-muted-foreground">
                  <span>{reasonLabel(entry.reason)}</span>
                  <span className={entry.delta > 0 ? "font-semibold text-foreground" : ""}>
                    {entry.delta > 0 ? "+" : ""}
                    {entry.delta}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {getPaddleEnvironment() === "sandbox" && (
          <p className="mt-4 rounded-lg bg-secondary/40 px-3 py-2 text-[11px] text-muted-foreground">
            Payments are in test mode in the preview — no real money is charged.
          </p>
        )}
      </div>

      {adOpen && (
        <div onClick={(e) => e.stopPropagation()}>
          <AdRewardModal onClose={() => setAdOpen(false)} onRewarded={credits.refresh} />
        </div>
      )}
    </div>

  );
}
