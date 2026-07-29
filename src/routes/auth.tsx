import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { DAILY_FLOOR, SIGNUP_GRANT } from "@/lib/credits";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in — Scanything scan credits" },
      {
        name: "description",
        content:
          "Sign in to Scanything to keep your scan credits, get a daily free top-up and track what every scan costs.",
      },
      { property: "og:title", content: "Sign in — Scanything scan credits" },
      {
        property: "og:description",
        content: "Keep your scan credits and get a daily free top-up in Scanything.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice(
            `Almost there — confirm your email to activate the account and your ${SIGNUP_GRANT} credits.`,
          );
          return;
        }
        toast.success(`Account created — ${SIGNUP_GRANT} credits added.`);
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
      <div className="gold-line w-full max-w-sm rounded-2xl bg-card p-6">
        <h1 className="gold-text mb-1 text-2xl font-bold">Scanything</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Sign in to keep your scan credits. New accounts start with {SIGNUP_GRANT} credits and top
          up to {DAILY_FLOOR} every day.
        </p>

        <button
          type="button"
          onClick={google}
          className="mb-4 w-full rounded-lg border border-primary/40 px-4 py-2.5 text-sm font-semibold text-primary"
        >
          Continue with Google
        </button>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-xs text-muted-foreground underline"
        >
          {mode === "signin" ? "No account? Sign up" : "Already have an account? Sign in"}
        </button>

        <Link to="/" className="mt-4 block text-center text-xs text-muted-foreground">
          Back to scanning
        </Link>
      </div>
    </main>
  );
}
