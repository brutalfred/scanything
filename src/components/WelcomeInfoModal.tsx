import { useEffect, useState } from "react";
import { X } from "lucide-react";

const KEY = "scanything.welcome.seen";

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
        className="gold-glow max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border-2 border-primary/70 bg-card p-5 text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold text-primary">Good to know</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="text-muted-foreground hover:text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="list-disc space-y-3 pl-5 text-sm">
          <li>Analyzing things through AI costs money.</li>
          <li className="font-semibold text-destructive">
            In Videomode, the credits will burn fast.
          </li>
          <li>
            My intention with this app is to help people identify things. For example the brand of a
            dress, a specific carmodel, a specific animal, maybe find out what a specific gadget is
            through deep analysis, translate a restaurants logo from chinese or arabic letters to
            latin alphabet, identify plants etc.
          </li>
          <li>
            Contact:{" "}
            <a href="mailto:scanythingapp@gmail.com" className="font-semibold text-primary underline">
              scanythingapp@gmail.com
            </a>
          </li>
        </ul>

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
