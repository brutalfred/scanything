import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isPiBrowser, piAuthenticate } from "@/lib/pi";
import { piLink, piSignIn } from "@/lib/pi.functions";
import { PENDING_REF_KEY } from "@/components/credits/ReferralCard";

/** Invite code captured from a Pi referral link, if there is one. */
function pendingReferralCode(): string | undefined {
  if (typeof window === "undefined") return undefined;
  let code: string | null = null;
  try {
    code = new URLSearchParams(window.location.search).get("ref");
    if (!code) code = localStorage.getItem(PENDING_REF_KEY);
  } catch {
    /* ignore */
  }
  const clean = (code ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(clean) ? clean : undefined;
}


/**
 * Pi Network sign-in.
 *
 * - Inside the Pi Browser the flow runs automatically once on load.
 * - When someone is already signed in with email/Google, the Pi identity is
 *   linked to that account instead of creating a second one.
 */
export function usePiAuth() {
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    setAvailable(isPiBrowser());
  }, []);

  const run = useCallback(async (silent: boolean) => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const auth = await piAuthenticate();
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        const profile = await piLink({ data: { accessToken: auth.accessToken } });
        if (!silent) {
          toast.success(
            profile.username
              ? `Pi account @${profile.username} connected`
              : "Pi account connected",
          );
        }
        return;
      }

      const result = await piSignIn({ data: { accessToken: auth.accessToken } });
      const { error } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: result.tokenHash,
      });
      if (error) throw error;
      toast.success(
        result.username ? `Signed in as @${result.username}` : "Signed in with Pi",
      );
    } catch (err) {
      if (!silent) {
        toast.error(err instanceof Error ? err.message : "Pi sign-in failed");
      } else {
        console.warn("[Pi] automatic sign-in skipped:", err);
      }
    } finally {
      running.current = false;
      setBusy(false);
    }
  }, []);

  const signInWithPi = useCallback(() => run(false), [run]);

  return { available, busy, signInWithPi, runPiAuth: run };
}

/** Auto-triggers Pi sign-in once, only inside the Pi Browser. */
export function usePiAutoSignIn() {
  const started = useRef(false);
  const { available, runPiAuth } = usePiAuth();

  useEffect(() => {
    if (!available || started.current) return;
    started.current = true;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled || data.session) return;
      void runPiAuth(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [available, runPiAuth]);
}
