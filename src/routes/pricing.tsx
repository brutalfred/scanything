import { createFileRoute, Link } from "@tanstack/react-router";
import { Coins, Check, Sparkles, Crown } from "lucide-react";
import { CREDIT_PACKS } from "@/lib/credit-packs";
import { CREDIT_COSTS, CREDIT_LABELS, SIGNUP_GRANT } from "@/lib/credits";
import type { CreditReason } from "@/lib/credits";
import { SUBSCRIPTION_DESCRIPTIONS, SUBSCRIPTION_PRICE_LABELS } from "@/lib/plan-mapping";


export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Scanything" },
      {
        name: "description",
        content: "Buy Scanything scan credits. Simple top-up packs for AI photo and video scans.",
      },
      { property: "og:title", content: "Pricing — Scanything" },
      {
        property: "og:description",
        content: "Simple pay-per-scan credit packs for Scanything.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://scanything.app/pricing" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://scanything.app/pricing" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "Scanything scan credits",
          description:
            "Prepaid credit packs used for AI photo scans, live video scans, translation and deeper item analysis in Scanything.",
          brand: { "@type": "Brand", name: "Scanything" },
          url: "https://scanything.app/pricing",
          offers: CREDIT_PACKS.map((pack) => ({
            "@type": "Offer",
            name: `${pack.label} — ${pack.credits} credits`,
            price: pack.priceLabel.replace("$", ""),
            priceCurrency: "USD",
            availability: "https://schema.org/InStock",
            url: "https://scanything.app/pricing",
          })),
        }),
      },
    ],
  }),

  component: PricingPage,
});

const FEATURES = [
  "AI object and text recognition",
  "Price estimates and quick links",
  "Photo and live video scanning",
  "Real-time detected-item list",
  "Translation and deeper analysis",
  "Document & receipt scanning",
];


function PricingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            ← Back to Scanything
          </Link>
          <span className="text-xs text-muted-foreground">Pricing</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
        <div className="text-center">
          <h1 className="text-4xl font-bold gold-text sm:text-5xl">Simple scan pricing</h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            Pay per scan with prepaid credits, or subscribe for unlimited scanning. Every scan mode is included in subscriptions.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {(["pro", "max"] as const).map((plan) => (
            <div
              key={plan}
              className={`relative flex flex-col rounded-2xl border-2 p-5 ${
                plan === "max"
                  ? "border-primary bg-primary/10 gold-glow"
                  : "border-border bg-secondary/30"
              }`}
            >
              {plan === "max" && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase text-primary-foreground">
                  Best value
                </span>
              )}
              <div className="mb-2 flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold text-foreground">
                  {plan === "max" ? "Scanything Max" : "Scanything Pro"}
                </h2>
              </div>
              <div className="mb-3 text-3xl font-bold text-primary">
                {SUBSCRIPTION_PRICE_LABELS[plan]}
              </div>
              <p className="mb-5 text-sm text-muted-foreground">
                {SUBSCRIPTION_DESCRIPTIONS[plan]}
              </p>
              <ul className="mb-5 space-y-2 text-sm text-muted-foreground">
                {(
                  plan === "max"
                    ? [
                        "Unlimited photo, document & resale scans",
                        "Unlimited live video / quick scans",
                        "Unlimited Analyze Further & Translate",
                        "Cancel any time",
                      ]
                    : [
                        "Unlimited photo, document & resale scans",
                        "Unlimited Analyze Further & Translate",
                        "Live scans still use credits",
                        "Cancel any time",
                      ]
                ).map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/"
                className="mt-auto block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Get {plan === "max" ? "Max" : "Pro"}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm font-medium text-muted-foreground">Or top up with credits</p>
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.priceId}
              className={`relative flex flex-col rounded-2xl border-2 p-5 transition-transform hover:-translate-y-1 ${
                pack.best
                  ? "border-primary bg-primary/10 gold-glow"
                  : "border-border bg-secondary/30 hover:border-primary/40"
              }`}
            >
              {pack.best && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase text-primary-foreground">
                  Best value
                </span>
              )}
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-foreground">{pack.label}</h2>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-primary">{pack.priceLabel}</span>
                  <span className="text-sm text-muted-foreground">one-time</span>
                </div>
              </div>

              <div className="mb-4 flex items-center gap-2 text-foreground">
                <Coins className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold tabular-nums">{pack.credits}</span>
                <span className="text-sm text-muted-foreground">credits</span>
              </div>

              <p className="mb-5 text-sm text-muted-foreground">
                ≈ {pack.photoScans} photo scans
              </p>

              <Link
                to="/"
                className="mt-auto block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Get started
              </Link>
            </div>
          ))}
        </div>


        <div className="mx-auto mt-14 max-w-3xl rounded-2xl border border-border bg-secondary/20 p-6 sm:p-8">
          <h3 className="mb-6 flex items-center gap-2 text-xl font-semibold text-foreground">
            <Sparkles className="h-5 w-5 text-primary" />
            What each action costs
          </h3>
          <ul className="space-y-3 text-sm">
            {(Object.keys(CREDIT_COSTS) as CreditReason[]).map((key) => (
              <li key={key} className="flex items-center justify-between border-b border-border/60 pb-3 last:border-b-0 last:pb-0">
                <span className="text-muted-foreground">{CREDIT_LABELS[key]}</span>
                <span className="font-semibold tabular-nums text-foreground">{CREDIT_COSTS[key]} credit(s)</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-secondary/20 p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">What's included</h3>
            <ul className="space-y-3">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-secondary/20 p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">New accounts</h3>
            <p className="text-sm text-muted-foreground">
              Every new Scanything account starts with {SIGNUP_GRANT} free credits so you can try a few scans before topping up. After that, buy a credit pack any time from the credit counter in the app.
            </p>
            <div className="mt-6">
              <Link
                to="/"
                className="inline-flex items-center justify-center rounded-lg border border-primary bg-transparent px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
              >
                Open the scanner
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <PaymentProcessorNote />
        </div>
      </main>
    </div>
  );
}

function PaymentProcessorNote() {
  return (
    <p className="text-xs text-muted-foreground">
      In the Android app, purchases are handled securely by Google Play billing.
      On the web, subscriptions and credit packs are processed by Paddle.
    </p>
  );
}

