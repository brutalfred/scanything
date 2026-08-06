import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { deleteMyData, type DataCategory } from "@/lib/account.functions";

export const Route = createFileRoute("/account/data")({
  head: () => ({
    meta: [
      { title: "Delete your Scanything data" },
      {
        name: "description",
        content:
          "Choose which Scanything data to delete — scan history, AI usage, game scores or activity — while keeping your account.",
      },
      { property: "og:title", content: "Delete your Scanything data" },
      {
        property: "og:description",
        content: "Delete selected Scanything data without deleting your account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DeleteDataPage,
});

const CATEGORIES: { id: DataCategory; label: string; description: string }[] = [
  {
    id: "scan_history",
    label: "Scan history",
    description: "All saved photo, video, resale and document scans, including their images and notes.",
  },
  {
    id: "ai_usage",
    label: "AI usage history",
    description: "Records of which scans were sent to the AI provider and what they cost.",
  },
  {
    id: "game_scores",
    label: "Game scores",
    description: "Your 400m Hurdles times and leaderboard entries.",
  },
  {
    id: "activity",
    label: "Activity records",
    description: "Sign-in visit days and daily free scan records.",
  },
  {
    id: "checkins",
    label: "Daily check-in streak",
    description: "Your streak counter and check-in reward history.",
  },
];

function DeleteDataPage() {
  const [selected, setSelected] = useState<DataCategory[]>([]);
  const [busy, setBusy] = useState(false);

  function toggle(id: DataCategory) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  async function handleDelete() {
    if (selected.length === 0) return;
    if (!window.confirm("Delete the selected data? This cannot be undone.")) return;
    setBusy(true);
    try {
      await deleteMyData({ data: { categories: selected } });
      toast.success("The selected data has been deleted");
      setSelected([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the data");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-10 text-foreground">
      <h1 className="text-2xl font-bold text-primary">Delete my data</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Select the data you want removed. Your account, credit balance and purchase records stay
        intact — to remove everything, delete your account instead.
      </p>

      <div className="mt-6 flex items-start gap-2 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <span>You must be signed in. Deletion is immediate and cannot be undone.</span>
      </div>

      <div className="mt-5 space-y-2">
        {CATEGORIES.map((cat) => (
          <label
            key={cat.id}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card/40 p-3 text-sm transition-colors hover:bg-card/70"
          >
            <input
              type="checkbox"
              checked={selected.includes(cat.id)}
              onChange={() => toggle(cat.id)}
              className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]"
            />
            <span>
              <span className="font-semibold">{cat.label}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{cat.description}</span>
            </span>
          </label>
        ))}
      </div>

      <button
        type="button"
        disabled={selected.length === 0 || busy}
        onClick={handleDelete}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Delete selected data
      </button>

      <Link
        to="/account/delete"
        className="mt-6 block text-center text-sm text-muted-foreground underline"
      >
        Delete my entire account instead
      </Link>
      <Link to="/" className="mt-2 block text-center text-sm text-muted-foreground underline">
        Back to Scanything
      </Link>
    </main>
  );
}
