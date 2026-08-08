import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund Policy — Scanything" },
      {
        name: "description",
        content:
          "Scanything offers a 30-day money-back guarantee on scan credit purchases. Learn how to request a refund through Google Play and how long refunds take.",
      },
      { property: "og:title", content: "Refund Policy — Scanything" },
      {
        property: "og:description",
        content:
          "A 30-day money-back guarantee on Scanything scan credits, plus how to request a refund and when it arrives.",
      },

      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefundPolicyPage,
});

const CONTACT_EMAIL = "scanythingapp@gmail.com";

function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            ← Back to Scanything
          </Link>
          <span className="text-xs text-muted-foreground">Refund Policy</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold gold-text">Refund Policy</h1>
        <p className="mb-8 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Money-back guarantee</h2>
            <p>
              We offer a <strong className="text-foreground">30-day money-back guarantee</strong> on credit purchases made through Scanything. If you are not satisfied with your purchase, you can request a full refund within 30 days of the order date.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">How to request a refund</h2>
            <p>
              <RefundChannel />
            </p>
          </section>


          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">What can be refunded</h2>
            <p>
              Refunds apply to unused credit balances purchased within the last 30 days. If you have already used the credits to perform scans or analysis, we may reduce the refund by the value of the used credits.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Refund timing</h2>
            <p>
              Approved refunds are typically returned to your original payment method within 5–10 business days, depending on your bank or payment provider.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Questions</h2>
            <p>
              If you have any questions about refunds, please contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

function RefundChannel() {
  return (
    <>
      Scan credits are sold as in-app products through Google Play, and Google is the
      seller of record for those purchases. Request a refund from your{" "}
      <a
        href="https://play.google.com/store/account/orderhistory"
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline"
      >
        Google Play order history
      </a>{" "}
      (Play Store → Payments &amp; subscriptions → Budget &amp; history), or contact us
      directly at{" "}
      <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
        {CONTACT_EMAIL}
      </a>{" "}
      and we will help you with the Google Play refund request.
    </>
  );
}

