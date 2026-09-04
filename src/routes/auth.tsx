import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { applyTheme, isThemeKey, THEME_STORAGE_KEY } from "@/lib/theme";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { PiSignInButton } from "@/components/PiAuthButton";
import { usePiMode } from "@/hooks/usePiMode";
import { SIGNUP_GRANT } from "@/lib/credits";
import { DISPOSABLE_EMAIL_MESSAGE, isDisposableEmail } from "@/lib/email-domains";
import authLogoAsset from "@/assets/scanything111.png.asset.json";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — Scanything scan credits" },
      {
        name: "description",
        content:
          "Sign in to Scanything to keep your scan credits, claim your one-time free trial credits and track what every scan costs.",
      },
      { property: "og:title", content: "Sign in — Scanything scan credits" },
      {
        property: "og:description",
        content: "Keep your scan credits and claim your one-time free trial in Scanything.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const piMode = usePiMode();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // The auth page always uses the cyber theme; restore the user's theme on leave.
  useEffect(() => {
    let restore: string | null = null;
    try {
      restore = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    applyTheme("cyber");
    return () => {
      applyTheme(isThemeKey(restore) ? restore : "cyber");
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("Reset link sent — check your inbox (and spam folder).");
        return;
      }
      if (mode === "signup") {
        if (isDisposableEmail(email)) {
          toast.error(DISPOSABLE_EMAIL_MESSAGE);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice(
            `Almost there — confirm your email to activate the account and claim your ${SIGNUP_GRANT} free trial credits.`,
          );
          return;
        }
        toast.success(`Account created — ${SIGNUP_GRANT} free trial credits added.`);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  }


  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5">
      <div className="w-full max-w-sm">
        <div className="relative mb-5 w-full">
          <img
            src={authLogoAsset.url}
            alt="Scanything — Scan anything, know everything"
            className="block w-full rounded-2xl"
          />
          {/* Flash on the camera lens in the artwork, every 3 seconds */}
          <div className="camera-flash" aria-hidden="true" />
        </div>
      <div className="gold-glow gold-line w-full max-w-sm rounded-2xl border-2 border-primary/70 bg-white p-6 text-black">
        {piMode ? (
          <>
            <PiSignInButton />
            <p className="mb-2 text-xs text-black/70">
              You're browsing Scanything in the Pi Browser. Sign in with your Pi
              account — no email, password or third-party login needed.
            </p>
          </>
        ) : (
          mode !== "forgot" && (
            <>
              <PiSignInButton />
              <button
                type="button"
                onClick={google}
                className="mb-4 w-full rounded-lg border border-black/30 px-4 py-2.5 text-sm font-semibold text-black hover:bg-black/5"
              >
                Continue with Google
              </button>
            </>
          )
        )}

        {!piMode && notice && (
          <p className="mb-4 rounded-lg bg-black/10 px-3 py-2 text-xs text-black">
            {notice}
          </p>
        )}

        {!piMode && (
        <><form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-black/20 bg-black px-3 py-2.5 text-sm text-white placeholder:text-white/60"
          />
          {mode !== "forgot" && (
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-lg border border-black/20 bg-black px-3 py-2.5 text-sm text-white placeholder:text-white/60"
            />
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          >
            {mode === "signin"
              ? "Sign in"
              : mode === "signup"
                ? "Create account"
                : "Send reset link"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setMode(mode === "signin" ? "signup" : "signin");
          }}
          className="mt-4 w-full text-xs text-black underline"
        >
          {mode === "signin" ? "No account? Sign up" : "Already have an account? Sign in"}
        </button>

        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setMode(mode === "forgot" ? "signin" : "forgot");
          }}
          className="mt-2 w-full text-xs text-black underline"
        >
          {mode === "forgot" ? "Back to sign in" : "Forgot your password?"}
        </button>
        </>
        )}

        <Link
          to="/"
          aria-label="Close"
          className="mx-auto mt-4 flex h-8 w-8 items-center justify-center rounded-full border border-black/20 text-red-500 hover:bg-black/5"
        >
          <X className="h-4 w-4" />
        </Link>
      </div>
      </div>
    </main>
  );
}
