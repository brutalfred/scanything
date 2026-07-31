import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/account/delete")({
  head: () => ({
    meta: [
      { title: "Delete your Scanything account" },
      {
        name: "description",
        content:
          "Permanently delete your Scanything account, credits and scan history. Deletion is immediate and cannot be undone.",
      },
      { property: "og:title", content: "Delete your Scanything account" },
      {
        property: "og:description",
        content: "Permanently delete your Scanything account and all associated data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteMyAccount();
      await supabase.auth.signOut();
      toast.success("Your account and all your data have been deleted");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-10 text-foreground">
      <h1 className="text-2xl font-bold text-primary">Delete your account</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Deleting your Scanything account removes your profile, credit balance, purchase records,
        scan usage history and daily check-in streak. This happens immediately and cannot be
        undone. Any remaining credits are lost and are not refundable.
      </p>

      <div className="mt-6 flex items-start gap-2 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <span>
          You must be signed in to delete your account. Type <strong>DELETE</strong> below to
          confirm.
        </span>
      </div>

      <input
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="DELETE"
        className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
      />

      <button
        type="button"
        disabled={confirm !== "DELETE" || busy}
        onClick={handleDelete}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Permanently delete my account
      </button>

      <Link to="/" className="mt-6 block text-center text-sm text-muted-foreground underline">
        Cancel and go back
      </Link>
    </main>
  );
}
