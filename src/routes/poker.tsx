import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { Spade } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PokerLobby } from "@/components/poker/PokerLobby";
import { PokerTable } from "@/components/poker/PokerTable";

export const Route = createFileRoute("/poker")({
  head: () => ({
    meta: [
      { title: "Texas Hold'em Poker — Scanything" },
      {
        name: "description",
        content:
          "Play free-chip Texas Hold'em with up to 4 players or against bots, right inside Scanything. No money, no payouts — just poker between scans.",
      },
      { property: "og:title", content: "Texas Hold'em Poker — Scanything" },
      {
        property: "og:description",
        content:
          "Free play-chip Texas Hold'em for 2-4 players, plus a solo mode against bots. Built into Scanything.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PokerPage,
});

function PokerPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [tableId, setTableId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <header className="mx-auto mb-6 flex w-full max-w-3xl items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Spade className="h-5 w-5" />
          Texas Hold'em
        </h1>
        <Link to="/" className="text-xs underline opacity-70 hover:opacity-100">
          Back to Scanything
        </Link>
      </header>

      {!ready && <p className="text-center text-sm opacity-70">Loading…</p>}

      {ready && !session && (
        <div className="theme-panel mx-auto max-w-md rounded-2xl p-5 text-center text-sm">
          <p className="font-semibold">Sign in to play</p>
          <p className="mt-1 opacity-70">
            Poker uses your Scanything account so your seat and play chips follow you.
          </p>
          <Link
            to="/auth"
            className="mt-4 inline-block rounded-xl border border-current bg-current/15 px-4 py-2 font-semibold"
          >
            Sign in
          </Link>
        </div>
      )}

      {ready && session && !tableId && <PokerLobby onEnter={setTableId} />}
      {ready && session && tableId && (
        <PokerTable tableId={tableId} onExit={() => setTableId(null)} />
      )}
    </main>
  );
}
