import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Coins, Loader2, Send, X, Crown, ExternalLink } from "lucide-react";
import { WatchAdButton } from "@/components/credits/WatchAdButton";
import { AnimatedCount } from "@/components/credits/AnimatedCount";


import { toast } from "sonner";
import { CREDIT_COSTS, CREDIT_LABELS, type CreditReason } from "@/lib/credits";
import { CREDIT_PACKS } from "@/lib/credit-packs";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { getPaddleEnvironment } from "@/lib/paddle";
import { isNativeAndroid } from "@/lib/platform";
import { buyWithPlay, buyPlaySubscription, playBillingAvailable } from "@/lib/play-billing";
import { PLAY_SUBSCRIPTIONS } from "@/lib/play-subscriptions";
import { SUBSCRIPTION_DESCRIPTIONS, SUBSCRIPTION_PRICE_LABELS, type PlanType } from "@/lib/plan-mapping";
import { createPortalSession } from "@/lib/subscription.functions";
import type { CreditsApi } from "@/hooks/useCredits";
import { useLanguage } from "@/hooks/useLanguage";
import { useServerFn } from "@tanstack/react-start";
import { transferCredits } from "@/lib/credits.functions";
import { useSubscription } from "@/hooks/useSubscription";



/** Web price IDs mapped to Google Play in-app product IDs. */
const PLAY_PRODUCT_BY_PRICE_ID: Record<string, string> = {
  credits_pack_1_price: "credits_1",
  credits_pack_5_price: "credits_5",
  credits_pack_10_price: "credits_10",
  credits_pack_50_price: "credits_50",
};

const PADDLE_SUBSCRIPTION_PRICE_IDS: Record<PlanType, string> = {
  pro: "scanything_pro_monthly",
  max: "scanything_max_monthly",
};

function reasonLabel(reason: string) {
  const base = reason.replace(/^refund:/, "").replace(/^purchase:.*$/, "purchase");
  if (base === "purchase") return "Credit top-up";
  return CREDIT_LABELS[base as CreditReason] ?? base.replace(/_/g, " ");
}

export function CreditsSheet({ credits, onClose }: { credits: CreditsApi; onClose: () => void }) {
  const { openCheckout } = usePaddleCheckout();
  const { t } = useLanguage();
  const subscription = useSubscription(credits.signedIn);
  const [buying, setBuying] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState<PlanType | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState("");

  const [sendAmount, setSendAmount] = useState("");
  const [sending, setSending] = useState(false);
  const sendCreditsFn = useServerFn(transferCredits);
  const openPortalFn = useServerFn(createPortalSession);

  async function sendCredits(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const res = await sendCreditsFn({
        data: { email: sendEmail.trim(), amount: Number(sendAmount) },
      });
      toast.success(`Sent ${sendAmount} credits to ${res.recipientEmail}`);
      setSendEmail("");
      setSendAmount("");
      setSendOpen(false);
      await credits.refresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send credits");
    } finally {
      setSending(false);
    }
  }

  async function openPortal() {
    if (!credits.signedIn) return;
    setOpeningPortal(true);
    try {
      const url = await openPortalFn({ data: { environment: getPaddleEnvironment() } });
      window.open(url, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open portal");
    } finally {
      setOpeningPortal(false);
    }
  }

  async function buySubscription(plan: PlanType) {
    if (!credits.signedIn || !credits.userId) {
      toast.error("Sign in first to start a subscription");
      return;
    }
    setSubscribing(plan);
    try {
      const androidApp = isNativeAndroid();
      if (androidApp) {
        const productId = PLAY_SUBSCRIPTIONS.find((s) => s.plan === plan)?.productId;
        if (!productId) throw new Error("This subscription is not available in the app");
        await buyPlaySubscription(productId);
        await subscription.refetch();
        await credits.refresh?.();
        toast.success(`${plan === "max" ? "Scanything Max" : "Scanything Pro"} activated`);
        return;
      }
      await openCheckout({
        priceId: PADDLE_SUBSCRIPTION_PRICE_IDS[plan],
        customerEmail: credits.email ?? undefined,
        customData: { userId: credits.userId },
        successUrl: `${window.location.origin}/?checkout=success`,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start subscription");
    } finally {
      setSubscribing(null);
    }
  }

  async function buy(priceId: string) {
    if (!credits.signedIn || !credits.userId) {
      toast.error("Sign in first so your credits are saved to your account");
      return;
    }
    setBuying(priceId);
    try {
      const androidApp = isNativeAndroid();
      if (androidApp) {
        if (!playBillingAvailable()) {
          throw new Error("Google Play billing is unavailable. Update Scanything from Google Play.");
        }
        // Play requires in-app purchases for digital goods inside the Android app.
        const productId = PLAY_PRODUCT_BY_PRICE_ID[priceId];
        if (!productId) throw new Error("This pack is not available in the app");
        await buyWithPlay(productId);
        await credits.refresh?.();
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

  const currentPlan = subscription.plan;

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

          <button onClick={onClose} aria-label={t("close")} className="text-muted-foreground hover:text-primary">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2 text-3xl font-bold text-primary">
          <Coins className="h-7 w-7" />
          <AnimatedCount value={credits.balance} />
          {credits.signedIn && (
            <button
              type="button"
              onClick={() => setSendOpen((v) => !v)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border-2 border-primary/60 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              <Send className="h-3.5 w-3.5" />
              Send credits
            </button>
          )}
        </div>

        {credits.signedIn && sendOpen && (
          <form
            onSubmit={sendCredits}
            className="mb-4 space-y-2 rounded-xl border border-primary/40 bg-secondary/30 p-3"
          >
            <p className="text-xs text-muted-foreground">
              Send credits to another Scanything account by email.
            </p>
            <input
              type="email"
              required
              value={sendEmail}
              onChange={(e) => setSendEmail(e.target.value)}
              placeholder="friend@example.com"
              maxLength={255}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={500}
                required
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                placeholder="Credits"
                className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm tabular-nums text-foreground outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={sending}
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        )}

        {!credits.signedIn && (
          <Link
            to="/auth"
            className="mb-5 block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground"
          >
            {t("signInToScan")}
          </Link>
        )}

        {credits.signedIn && (
          <>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
              <Crown className="h-4 w-4" />
              Subscriptions
            </h3>
            <div className="mb-4 grid grid-cols-1 gap-2">
              {(["pro", "max"] as PlanType[]).map((plan) => {
                const isCurrent = currentPlan === plan;
                const isDowngrade = currentPlan === "max" && plan === "pro";
                const label = plan === "max" ? "Scanything Max" : "Scanything Pro";
                return (
                  <div
                    key={plan}
                    className={`rounded-xl border-2 p-3 ${
                      isCurrent ? "border-primary bg-primary/10" : "border-border bg-secondary/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-foreground">{label}</div>
                        <div className="text-xs text-muted-foreground">
                          {SUBSCRIPTION_DESCRIPTIONS[plan]}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-primary">
                          {SUBSCRIPTION_PRICE_LABELS[plan]}
                        </div>
                        {isCurrent && (
                          <span className="text-[10px] font-bold uppercase text-primary">Current</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={subscribing !== null || isCurrent || isDowngrade || openingPortal}
                      onClick={() => buySubscription(plan)}
                      className="mt-2 w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                    >
                      {subscribing === plan
                        ? "Processing…"
                        : isCurrent
                          ? "Current plan"
                          : isDowngrade
                            ? "Downgrade not available"
                            : "Subscribe"}
                    </button>
                  </div>
                );
              })}
            </div>
            {subscription.subscription?.source === "paddle" && (
              <button
                type="button"
                onClick={openPortal}
                disabled={openingPortal}
                className="mb-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary/60 px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
              >
                <ExternalLink className="h-4 w-4" />
                {openingPortal ? "Opening…" : "Manage subscription"}
              </button>
            )}
            {subscription.subscription?.source === "play" && (
              <p className="mb-4 text-xs text-muted-foreground">
                Manage your subscription in the Google Play Store app.
              </p>
            )}
          </>
        )}

        <h3 className="mb-2 text-sm font-semibold text-primary">{t("topUp")}</h3>

        <div className="mb-3">
          <WatchAdButton
            signedIn={credits.signedIn}
            onRewarded={() => void credits.refresh?.()}
          />
        </div>


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

    </div>

  );
}
