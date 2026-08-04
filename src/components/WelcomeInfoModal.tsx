import { useEffect, useState } from "react";
import { X, Coins, Video, Sparkles, Aperture, Gift } from "lucide-react";

const KEY = "scanything.welcome.seen";

const tips = [
  {
    icon: Gift,
    title: "One free photo scan every day",
    body: "Signed-in users get one free photo scan per day — it costs no credits and resets every day.",
  },
  {
    icon: Coins,
    title: "AI analysis costs credits",
    body: "Every scan uses AI processing, so each analysis deducts credits from your balance.",
  },
  {
    icon: Video,
    title: "Video mode drains credits fast",
    body: "Continuous video scanning processes many frames per second. Use it sparingly.",
    highlight: true,
  },
  {
    icon: Sparkles,
    title: "Built for discovery",
    body: "Identify items, animals, plants and more with prices, links, translations and a bit of fun.",
  },
  {
    icon: Aperture,
    title: "Clear photos work best",
    body: "Close-up shots with a clean, well-lit lens make scans much more accurate.",
  },
];

export function WelcomeInfoModal({ signedIn, userId }: { signedIn: boolean; userId: string | null }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!signedIn || !userId) return;
    try {
      if (sessionStorage.getItem(`${KEY}.${userId}`)) return;
      sessionStorage.setItem(`${KEY}.${userId}`, "1");
    } catch {
      /* ignore */
    }
    setOpen(true);
  }, [signedIn, userId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="gold-glow relative max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-primary/30 bg-card p-7 text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-primary"
        >
          <X className="h-5 w-5" />
        </button>

        <header className="mb-6 text-center">
          <span className="font-heading mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Welcome
          </span>
          <h2 className="font-heading text-2xl font-semibold tracking-tight text-primary">
            Good to know
          </h2>
          <div className="gold-line mx-auto mt-4 h-px w-12" />
        </header>

        <ul className="space-y-5">
          {tips.map((tip) => {
            const Icon = tip.icon;
            return (
              <li key={tip.title} className="flex items-start gap-4">
                <div className="mt-0.5 flex-shrink-0 rounded-lg border border-primary/20 bg-primary/10 p-2">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p
                    className={`font-body text-sm font-medium ${
                      tip.highlight ? "text-destructive" : "text-foreground"
                    }`}
                  >
                    {tip.title}
                  </p>
                  <p className="font-body mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    {tip.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-7 w-full rounded-xl bg-gradient-to-r from-primary via-primary to-primary/80 px-4 py-3.5 font-heading text-sm font-semibold text-primary-foreground shadow-[0_4px_20px_-5px_color-mix(in_oklab,oklch(0.82_0.15_85)_40%,transparent)] transition-all duration-300 active:scale-[0.98]"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
