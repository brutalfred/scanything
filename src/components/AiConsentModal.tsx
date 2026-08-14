import { Link } from "@tanstack/react-router";
import { useSlideDismiss } from "@/hooks/useSlideDismiss";
import { Camera, Cpu, ShieldCheck, EyeOff } from "lucide-react";

export function AiConsentModal({
  open,
  onAccept,
  onDecline,
}: {
  open: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const slide = useSlideDismiss("bottom", onDecline);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div
        {...slide}
        className={`w-full max-w-md rounded-2xl border border-primary/40 bg-background p-5 text-foreground shadow-[0_0_40px_-10px_hsl(var(--primary)/0.6)] ${slide.className}`}
      >
        <div className="flex items-center gap-2 text-primary">
          <ShieldCheck className="h-5 w-5" />
          <h2 className="text-base font-semibold">Camera &amp; AI consent</h2>
        </div>

        <p className="mt-3 text-sm leading-relaxed opacity-90">
          Scanything needs your permission before it uses your camera and sends
          pictures to an AI provider for analysis.
        </p>

        <ul className="mt-4 space-y-3 text-sm">
          <li className="flex gap-2">
            <Camera className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              The camera preview stays on your device. Nothing is sent until you
              start a scan.
            </span>
          </li>
          <li className="flex gap-2">
            <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              When you scan, the captured frame is sent to our AI provider to
              identify objects and return information.
            </span>
          </li>
          <li className="flex gap-2">
            <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Photos are not used to identify people, and are not stored beyond
              your own scan history.
            </span>
          </li>
        </ul>

        <p className="mt-3 text-xs opacity-70">
          You can withdraw this consent at any time in the account tab. See our{" "}
          <Link
            to="/privacy"
            className="underline decoration-primary/60 underline-offset-2 hover:text-primary"
          >
            Privacy Notice
          </Link>
          .
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            type="button"
            onClick={onAccept}
            className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            I agree — enable camera &amp; AI
          </button>
          <button
            type="button"
            onClick={onDecline}
            className="flex-1 rounded-lg border border-primary/40 px-4 py-2 text-sm font-medium transition-colors hover:bg-primary/10"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
