import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { parsePiOAuthCallback } from "@/lib/pi-signin";
import { piLink, piSignIn } from "@/lib/pi.functions";
import { PENDING_REF_KEY } from "@/components/credits/ReferralCard";

export const Route = createFileRoute("/auth/pi-callback")({
  head: () => ({
    meta: [
      { title: "Signing in with Pi — Scanything" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PiCallbackPage,
});

function pendingReferralCode(): string | undefined {
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

function PiCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Finishing Pi sign-in…");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      const parsed = parsePiOAuthCallback(window.location.hash);
      if (!parsed.ok) {
        setMessage(parsed.error);
        return;
      }

      // Already signed in with email/Google? Link Pi to that account instead.
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        await piLink({ data: { accessToken: parsed.accessToken } });
        navigate({ to: parsed.returnTo, replace: true });
        return;
      }

      const result = await piSignIn({
        data: {
          accessToken: parsed.accessToken,
          referralCode: pendingReferralCode(),
        },
      });
      const { error } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: result.tokenHash,
      });
      if (error) throw error;
      if (result.referralStatus === "redeemed") {
        try {
          localStorage.removeItem(PENDING_REF_KEY);
        } catch {
          /* ignore */
        }
      }
      navigate({ to: parsed.returnTo, replace: true });
    })().catch((err) => {
      setMessage(err instanceof Error ? err.message : "Pi sign-in failed");
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <p className="text-sm text-foreground/80">{message}</p>
    </div>
  );
}
