import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Handles OAuth redirect callbacks that land inside the Capacitor WebView.
 *
 * When the WebView stays in the app during Lovable Cloud OAuth, the broker
 * redirects back to the site with Supabase-style tokens in the URL hash.
 * Supabase normally detects these on init, but in a remote WebView with a
 * custom user agent we force a manual recovery so the shell is definitely
 * signed in after the round trip.
 */
export function useOAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash.slice(1);
    const query = window.location.search.slice(1);
    const params = new URLSearchParams(hash || query);

    const hasOAuthCallback =
      params.has("access_token") &&
      params.has("refresh_token") &&
      (!params.has("type") || params.get("type") === "oauth");

    if (!hasOAuthCallback) return;

    let cancelled = false;
    (async () => {
      // Trigger Supabase to recover the session from the URL hash.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;

      if (session) {
        // Clean the URL so a refresh doesn't try to reuse the tokens.
        if (window.location.hash) {
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search,
          );
        }
        await navigate({ to: "/" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);
}
