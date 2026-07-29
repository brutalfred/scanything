import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Set a new password — Scanything" },
      {
        name: "description",
        content:
          "Choose a new password for your Scanything account and get straight back to scanning with your saved credits.",
      },
      { property: "og:title", content: "Set a new password — Scanything" },
      {
        property: "og:description",
        content: "Choose a new Scanything password and keep your scan credits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setValid(true);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      const hash = typeof window !== "undefined" ? window.location.hash : "";
      setValid(Boolean(data.session) || hash.includes("type=recovery"));
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated");
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-5">
      <div className="gold-line w-full max-w-sm rounded-2xl bg-card p-6">
        <h1 className="gold-text mb-1 text-2xl font-bold">New password</h1>

        {!ready ? (
          <p className="text-sm text-muted-foreground">Checking your reset link…</p>
        ) : !valid ? (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              This reset link is invalid or has expired. Request a new one from the sign-in page.
            </p>
            <Link
              to="/auth"
              className="block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              Pick a new password — your credits and history stay exactly as they were.
            </p>
            <form onSubmit={submit} className="space-y-3">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              />
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repeat new password"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save password"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
