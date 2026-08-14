import { useCallback, useEffect, useState } from "react";
import { useSlideDismiss } from "@/hooks/useSlideDismiss";
import { Camera, Coins, SlidersHorizontal, Sparkles, X } from "lucide-react";

const SEEN_KEY = "scanything.onboarding.seen";
export const ONBOARDING_EVENT = "scanything:onboarding";

/** Opens the walkthrough from anywhere (e.g. the account tab button). */
export function openOnboarding() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ONBOARDING_EVENT));
}

const STEPS = [
  {
    icon: Camera,
    title: "Point and scan",
    body: "Aim the camera at a room, an object, a document or a plant and hit the scan button. Scanything names everything it recognises in one pass.",
  },
  {
    icon: SlidersHorizontal,
    title: "Filter what you look for",
    body: "Use the filter row above the camera to narrow the scan to a category — furniture, electronics, plants, text and more. Fewer categories means faster, sharper results.",
  },
  {
    icon: Sparkles,
    title: "Tap an item for the deep dive",
    body: "Every result opens into a detail card with a description, price range, buying links and an AI chat where you can ask anything about that exact item. Save the good ones to a collection.",
  },
  {
    icon: Coins,
    title: "Credits keep it running",
    body: "You get one free photo scan every day, plus daily check-in bonuses, rewarded ads and invite bonuses. Video mode uses credits quickly, so keep it short.",
  },
];

export function OnboardingTour({ signedIn, userId }: { signedIn: boolean; userId: string | null }) {
  const [open, setOpen] = useState(false);
  const slide = useSlideDismiss("bottom", () => setOpen(false));
  const [step, setStep] = useState(0);

  const start = useCallback(() => {
    setStep(0);
    setOpen(true);
  }, []);

  // Replay trigger from the account tab.
  useEffect(() => {
    const handler = () => start();
    window.addEventListener(ONBOARDING_EVENT, handler);
    return () => window.removeEventListener(ONBOARDING_EVENT, handler);
  }, [start]);

  // First run per account.
  useEffect(() => {
    if (!signedIn || !userId) return;
    try {
      if (localStorage.getItem(`${SEEN_KEY}.${userId}`)) return;
      localStorage.setItem(`${SEEN_KEY}.${userId}`, "1");
    } catch {
      return;
    }
    const timer = setTimeout(start, 900);
    return () => clearTimeout(timer);
  }, [signedIn, userId, start]);

  if (!open) return null;

  const current = STEPS[step]!;
  const Icon = current.icon;
  const last = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-label="How Scanything works"
        {...slide}
        onClick={(e) => e.stopPropagation()}
        className={`gold-glow relative w-full max-w-sm rounded-2xl border border-primary/30 bg-card p-7 text-foreground ${slide.className}`}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-primary"
        >
          <X className="h-5 w-5" />
        </button>

        <span className="font-heading block text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </span>

        <div className="mt-5 flex justify-center">
          <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4">
            <Icon className="h-8 w-8 text-primary" />
          </div>
        </div>

        <h2 className="font-heading mt-5 text-center text-xl font-semibold tracking-tight text-primary">
          {current.title}
        </h2>
        <p className="font-body mt-3 text-center text-sm leading-relaxed text-muted-foreground">
          {current.body}
        </p>

        <div className="mt-6 flex justify-center gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-5 bg-primary" : "w-1.5 bg-primary/30"
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="rounded-xl border border-primary/30 px-4 py-3 font-heading text-sm font-semibold text-foreground transition-colors hover:bg-primary/10"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? setOpen(false) : setStep((s) => s + 1))}
            className="flex-1 rounded-xl bg-primary px-4 py-3 font-heading text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.98]"
          >
            {last ? "Start scanning" : "Next"}
          </button>
        </div>

        {!last && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-3 w-full text-center text-xs text-muted-foreground underline"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
