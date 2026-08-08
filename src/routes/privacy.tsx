import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — Scanything" },
      {
        name: "description",
        content:
          "How Scanything handles your personal data, camera images and scan history, including storage, AI processing, cookies and your privacy rights.",
      },
      { property: "og:title", content: "Privacy Notice — Scanything" },
      {
        property: "og:description",
        content:
          "How Scanything handles your personal data, camera images and scan history, including AI processing and your privacy rights.",
      },

      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

const SELLER_NAME = "John FREDRIK Mikael Paulsson";
const APP_NAME = "Scanything";
const CONTACT_EMAIL = "scanythingapp@gmail.com";

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3">
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            ← Back to Scanything
          </Link>
          <span className="text-xs text-muted-foreground">Privacy Notice</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold gold-text">Privacy Notice</h1>
        <p className="mb-8 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Who we are</h2>
            <p>
              This Privacy Notice is provided by <strong className="text-foreground">{SELLER_NAME}</strong>, the seller of {APP_NAME}. I act as the data controller for the personal data collected through the app.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">What personal data we collect</h2>
            <p>We collect and process the following categories of personal data:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong className="text-foreground">Account data:</strong> email address, user ID, and authentication information when you sign up or sign in.
              </li>
              <li>
                <strong className="text-foreground">Usage data:</strong> scan history, credit balance, credit purchases, and feature usage.
              </li>
              <li>
                <strong className="text-foreground">Image data:</strong> photos or video frames you submit for AI analysis. These are processed in real time and are not permanently stored unless you choose to save an image to your own device.
              </li>
              <li>
                <strong className="text-foreground">Device and technical data:</strong> IP address, device type, browser information, and crash logs to help us operate and improve the app.
              </li>
              <li>
                <strong className="text-foreground">Support data:</strong> messages and information you send when contacting support.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Why we process your data</h2>
            <p>We use your personal data for the following purposes and legal bases:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong className="text-foreground">To provide the service:</strong> creating your account, processing scans, and managing your credits. (Legal basis: contract performance)
              </li>
              <li>
                <strong className="text-foreground">To process payments:</strong> purchases of scan credits are handled by Google Play billing, which processes the payment, tax and receipt. We only receive a confirmation that the purchase succeeded. (Legal basis: contract performance)
              </li>
              <li>
                <strong className="text-foreground">To keep the app secure:</strong> preventing fraud, abuse, and unauthorized access. (Legal basis: legitimate interests)
              </li>
              <li>
                <strong className="text-foreground">To improve the app:</strong> analyzing usage and fixing errors. (Legal basis: legitimate interests)
              </li>
              <li>
                <strong className="text-foreground">To communicate with you:</strong> support responses and important service updates. (Legal basis: contract performance or legitimate interests)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Who we share data with</h2>
            <p>We share personal data only with the following categories of recipients:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong className="text-foreground">Google Play billing:</strong> Google is the seller of record for in-app purchases and processes payments, tax, invoicing and refunds. We never receive or store your card details.
              </li>
              <li>
                <strong className="text-foreground">AI and cloud service providers:</strong> providers that help us run image analysis and host the app.
              </li>
              <li>
                <strong className="text-foreground">Professional advisers:</strong> accountants or legal advisers when necessary.
              </li>
              <li>
                <strong className="text-foreground">Authorities:</strong> when required by law or to protect our rights.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">International transfers</h2>
            <p>
              Some of our service providers may process data outside the European Economic Area. When this happens, we rely on appropriate safeguards such as Standard Contractual Clauses to protect your data.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">How long we keep your data</h2>
            <p>
              We keep your personal data only as long as necessary for the purposes described above. Account data is kept while your account is active. When you delete your account, we remove or anonymize your data within a reasonable time, unless we are required to keep it longer by law.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Your rights</h2>
            <p>Under GDPR, you have the following rights:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Access your personal data.</li>
              <li>Correct inaccurate data.</li>
              <li>
                Request deletion of your data — you can do this at any time through the{" "}
                <Link to="/account/delete" className="text-primary underline">
                  account deletion page
                </Link>
                .
              </li>
              <li>
                Delete only parts of your data (scan history, AI usage history, game scores,
                activity records) while keeping your account, through the{" "}
                <Link to="/account/data" className="text-primary underline">
                  delete my data page
                </Link>
                .
              </li>

              <li>Restrict or object to processing.</li>
              <li>Receive your data in a portable format.</li>
              <li>Withdraw consent where processing is based on consent.</li>
              <li>Lodge a complaint with your national data protection authority.</li>
            </ul>
            <p className="mt-2">
              We aim to respond to requests within one month. To exercise your rights, contact us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Security</h2>
            <p>
              We use appropriate technical and organizational measures to protect your data, including encryption, access controls, and secure hosting. No system is completely secure, so we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Cookies</h2>
            <p>
              {APP_NAME} uses essential cookies and similar technologies to keep you signed in, manage your credits, and operate the app. When you first visit, we ask for your consent to any non-essential cookies. You can change your choice at any time by clearing your browser storage for this site. We do not use third-party marketing or analytics cookies without your consent.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Changes to this notice</h2>
            <p>
              We may update this Privacy Notice from time to time. The latest version will always be available at this page.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Contact</h2>
            <p>
              For privacy questions, contact us at{" "}
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
