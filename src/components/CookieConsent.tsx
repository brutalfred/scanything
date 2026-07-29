import { Link } from "@tanstack/react-router";
import { useCookieConsent } from "@/hooks/useCookieConsent";

export function CookieConsent() {
  const { mounted, hasConsented, acceptAll, acceptNecessary } = useCookieConsent();

  // Don't render during SSR/hydration to avoid mismatch with localStorage state.
  if (!mounted || hasConsented) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-primary/40 bg-black/90 backdrop-blur-md p-4 shadow-2xl">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm leading-relaxed text-foreground/90">
          <p className="font-medium text-primary">We value your privacy</p>
          <p className="mt-1">
            Scanything uses only essential cookies to keep you signed in and run the app. 
            We do not use third-party marketing or analytics cookies unless you choose to allow them.
          </p>
          <p className="mt-1">
            Read more in our{" "}
            <Link
              to="/privacy"
              className="underline decoration-primary/60 underline-offset-2 hover:text-primary"
            >
              Privacy Notice
            </Link>
            .
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={acceptNecessary}
            className="rounded-md border border-primary/60 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
          >
            Necessary only
          </button>
          <button
            onClick={acceptAll}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md transition-colors hover:bg-primary/90"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
