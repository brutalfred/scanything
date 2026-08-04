import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  adminGrantCredits,
  getAdminGrants,
  getAdminUsageStats,
  getIsAdmin,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Grant credits | Scanything" },
      {
        name: "description",
        content: "Owner-only tool to add scan credits to a Scanything account.",
      },
      { property: "og:title", content: "Admin — Grant credits | Scanything" },
      {
        property: "og:description",
        content: "Owner-only tool to add scan credits to a Scanything account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const checkAdmin = useServerFn(getIsAdmin);
  const grant = useServerFn(adminGrantCredits);
  const fetchGrants = useServerFn(getAdminGrants);

  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("100");
  const [busy, setBusy] = useState(false);

  const admin = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkAdmin(),
    retry: false,
  });

  const grants = useQuery({
    queryKey: ["admin-grants"],
    queryFn: () => fetchGrants(),
    enabled: admin.data === true,
    retry: false,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await grant({ data: { email, amount: Number(amount) } });
      toast.success(`Added ${result.credits} credits to ${result.email} (new balance ${result.balance})`);
      setEmail("");
      grants.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not grant credits");
    } finally {
      setBusy(false);
    }
  }

  if (admin.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
        <p className="text-sm opacity-70">Checking access…</p>
      </main>
    );
  }

  if (admin.data !== true) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-foreground">
        <h1 className="text-xl font-bold text-primary">Not authorized</h1>
        <p className="text-sm opacity-70">This page is only available to the app owner.</p>
        <Link to="/" className="text-sm font-semibold text-primary underline">
          Back to Scanything
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-5 text-foreground">
      <div className="mx-auto max-w-md">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-primary">Grant credits</h1>
          <Link to="/" className="text-xs font-semibold text-primary underline">
            Back
          </Link>
        </div>

        <form
          onSubmit={onSubmit}
          className="theme-panel gold-glow space-y-3 rounded-2xl p-4 text-sm"
        >
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide opacity-70">
              Account email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@example.com"
              className="w-full rounded-lg border border-current/30 bg-transparent px-3 py-2 outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide opacity-70">
              Credits to add
            </span>
            <input
              type="number"
              min={1}
              max={100000}
              step={1}
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-current/30 bg-transparent px-3 py-2 outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-primary px-4 py-2.5 font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Granting…" : "Grant credits"}
          </button>
        </form>

        <h2 className="mb-2 mt-6 text-sm font-semibold text-primary">Recent admin grants</h2>
        {grants.isLoading ? (
          <p className="text-xs opacity-70">Loading…</p>
        ) : (grants.data?.length ?? 0) === 0 ? (
          <p className="text-xs opacity-70">No admin grants yet.</p>
        ) : (
          <ul className="space-y-1 text-xs">
            {grants.data?.map((g) => (
              <li key={g.id} className="flex justify-between gap-3 border-b border-current/15 pb-1">
                <span className="truncate opacity-80">{g.email}</span>
                <span className="whitespace-nowrap font-semibold">+{g.delta}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
