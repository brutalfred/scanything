import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Bot, Loader2, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  addPokerBots,
  getPokerTable,
  leavePokerTable,
  pokerAction,
  startPokerHand,
  tickPokerTable,
} from "@/lib/poker.functions";
import { TURN_SECONDS, type TableView } from "@/lib/poker";
import { PlayingCard } from "./PlayingCard";

export function PokerTable({ tableId, onExit }: { tableId: string; onExit: () => void }) {
  const queryClient = useQueryClient();
  const fetchTable = useServerFn(getPokerTable);
  const tick = useServerFn(tickPokerTable);
  const act = useServerFn(pokerAction);
  const start = useServerFn(startPokerHand);
  const fill = useServerFn(addPokerBots);
  const leave = useServerFn(leavePokerTable);

  const [raiseTo, setRaiseTo] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);

  const key = useMemo(() => ["poker-table", tableId], [tableId]);
  const { data } = useQuery<TableView>({
    queryKey: key,
    queryFn: () => fetchTable({ data: { tableId } }),
    refetchInterval: 3000,
  });

  // Realtime: any seat or table change re-reads the sanitized view.
  useEffect(() => {
    const channel = supabase
      .channel(`poker:${tableId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poker_seats", filter: `table_id=eq.${tableId}` },
        () => void queryClient.invalidateQueries({ queryKey: key }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "poker_tables", filter: `id=eq.${tableId}` },
        () => void queryClient.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tableId, queryClient, key]);

  // Heartbeat drives bot turns, the turn clock and the next deal.
  useEffect(() => {
    const id = window.setInterval(() => {
      void tick({ data: { tableId } }).then(() =>
        queryClient.invalidateQueries({ queryKey: key }),
      );
    }, 2500);
    return () => window.clearInterval(id);
  }, [tableId, tick, queryClient, key]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const mutate = useMutation({
    mutationFn: (vars: { action: "fold" | "check" | "call" | "raise" | "allin"; amount?: number }) =>
      act({ data: { tableId, action: vars.action, amount: vars.amount ?? 0 } }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: () => setError("That move wasn't allowed — try again."),
  });

  const hand = data?.hand ?? null;
  const seats = data?.seats ?? [];
  const me = seats.find((s) => s.isMe) ?? null;
  const myTurn = Boolean(hand && hand.status === "active" && hand.actingSeat === me?.seatIndex);
  const toCall = me && hand ? Math.max(0, hand.currentBet - me.currentBet) : 0;
  const maxRaiseTo = me ? me.currentBet + me.stack : 0;
  const minRaiseTo = hand ? Math.min(hand.currentBet + hand.minRaise, maxRaiseTo) : 0;

  useEffect(() => {
    if (myTurn) setRaiseTo(Math.max(minRaiseTo, 0));
  }, [myTurn, minRaiseTo]);

  const secondsLeft = hand?.deadline
    ? Math.max(0, Math.ceil((new Date(hand.deadline).getTime() - now) / 1000))
    : null;

  const occupied = seats.filter((s) => s.userId || s.isBot);
  const humans = seats.filter((s) => s.userId);
  const emptySeats = seats.length - occupied.length;
  const canStart = occupied.length >= 2 && (!hand || hand.status === "complete");

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={async () => {
            await leave({ data: { tableId } });
            onExit();
          }}
          className="inline-flex items-center gap-1 rounded-xl border border-current/30 bg-current/5 px-3 py-2 text-xs font-semibold hover:bg-current/10"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Leave table
        </button>
        <p className="truncate text-sm font-semibold">{data.name}</p>
        <p className="text-xs opacity-70">
          Blinds {data.smallBlind}/{data.bigBlind}
        </p>
      </div>

      {/* Felt */}
      <div className="theme-panel gold-glow mt-4 rounded-3xl p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {seats.map((seat) => {
            const acting = hand?.status === "active" && hand.actingSeat === seat.seatIndex;
            const dealer = hand?.dealerSeat === seat.seatIndex;
            const empty = !seat.userId && !seat.isBot;
            return (
              <div
                key={seat.seatIndex}
                className={`rounded-2xl border p-2 text-xs transition-colors ${
                  acting ? "border-current bg-current/15" : "border-current/25 bg-current/5"
                } ${seat.folded && seat.inHand ? "opacity-40" : ""}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate font-semibold">
                    {empty ? "Empty seat" : seat.displayName}
                    {seat.isBot && <Bot className="ml-1 inline h-3 w-3" />}
                  </span>
                  {dealer && !empty && (
                    <span className="rounded-full border border-current/40 px-1.5 text-[9px] font-bold">
                      D
                    </span>
                  )}
                </div>
                {!empty && (
                  <>
                    <p className="tabular-nums opacity-80">{seat.stack} chips</p>
                    <div className="mt-1 flex h-11 items-center gap-1">
                      {seat.inHand && !seat.folded ? (
                        seat.isMe && data.myHole ? (
                          data.myHole.map((c) => <PlayingCard key={c} card={c} size="sm" />)
                        ) : seat.shownCards ? (
                          seat.shownCards.map((c) => <PlayingCard key={c} card={c} size="sm" />)
                        ) : (
                          <>
                            <PlayingCard faceDown size="sm" />
                            <PlayingCard faceDown size="sm" />
                          </>
                        )
                      ) : (
                        <span className="opacity-50">—</span>
                      )}
                    </div>
                    <p className="mt-1 flex items-center justify-between">
                      <span className="opacity-70">{seat.lastAction ?? ""}</span>
                      {seat.currentBet > 0 && (
                        <span className="rounded-full border border-current/40 px-1.5 tabular-nums">
                          {seat.currentBet}
                        </span>
                      )}
                    </p>
                    {acting && secondsLeft !== null && (
                      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-current/20">
                        <div
                          className="h-full bg-current transition-[width] duration-200"
                          style={{ width: `${(secondsLeft / TURN_SECONDS) * 100}%` }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-current/20 bg-current/5 p-4">
          <p className="text-xs uppercase tracking-wide opacity-70">
            {hand ? `${hand.stage} · pot ${hand.pot}` : "Waiting for players"}
          </p>
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => {
              const card = hand?.board[i];
              return card === undefined ? (
                <div key={i} className="h-16 w-11 rounded-lg border border-dashed border-current/20" />
              ) : (
                <PlayingCard key={card} card={card} />
              );
            })}
          </div>
          {hand?.resultText && (
            <p className="text-center text-sm font-semibold">{hand.resultText}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4">
        {error && <p className="mb-2 text-center text-xs text-destructive">{error}</p>}

        {!me && (
          <p className="text-center text-sm opacity-70">
            You are watching this table. Leave and re-join from the lobby to take a seat.
          </p>
        )}

        {me && myTurn && (
          <div className="theme-panel rounded-2xl p-3">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={mutate.isPending}
                onClick={() => mutate.mutate({ action: "fold" })}
                className="flex-1 rounded-xl border border-destructive/50 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10"
              >
                Fold
              </button>
              <button
                type="button"
                disabled={mutate.isPending}
                onClick={() => mutate.mutate({ action: toCall === 0 ? "check" : "call" })}
                className="flex-1 rounded-xl border border-current/40 bg-current/10 px-3 py-2 text-sm font-semibold hover:bg-current/20"
              >
                {toCall === 0 ? "Check" : `Call ${Math.min(toCall, me.stack)}`}
              </button>
              <button
                type="button"
                disabled={mutate.isPending}
                onClick={() => mutate.mutate({ action: "allin" })}
                className="flex-1 rounded-xl border border-current/40 bg-current/10 px-3 py-2 text-sm font-semibold hover:bg-current/20"
              >
                All-in
              </button>
            </div>
            {maxRaiseTo > minRaiseTo && (
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="range"
                  min={minRaiseTo}
                  max={maxRaiseTo}
                  step={data.bigBlind}
                  value={Math.min(Math.max(raiseTo, minRaiseTo), maxRaiseTo)}
                  onChange={(e) => setRaiseTo(Number(e.target.value))}
                  className="flex-1 accent-current"
                />
                <button
                  type="button"
                  disabled={mutate.isPending}
                  onClick={() => mutate.mutate({ action: "raise", amount: raiseTo })}
                  className="rounded-xl border border-current bg-current/15 px-3 py-2 text-sm font-semibold hover:bg-current/25"
                >
                  Raise to {Math.min(Math.max(raiseTo, minRaiseTo), maxRaiseTo)}
                </button>
              </div>
            )}
          </div>
        )}

        {me && !myTurn && hand?.status === "active" && (
          <p className="text-center text-sm opacity-70">Waiting for other players…</p>
        )}

        {canStart && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            {emptySeats > 0 && (
              <button
                type="button"
                onClick={async () => {
                  await fill({ data: { tableId, count: emptySeats } });
                  void queryClient.invalidateQueries({ queryKey: key });
                }}
                className="flex-1 rounded-xl border border-current/30 bg-current/5 px-3 py-2 text-sm font-semibold hover:bg-current/10"
              >
                <Bot className="mr-1 inline h-4 w-4" /> Fill empty seats with bots
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                await start({ data: { tableId } });
                void queryClient.invalidateQueries({ queryKey: key });
              }}
              className="flex-1 rounded-xl border border-current bg-current/15 px-3 py-2 text-sm font-semibold hover:bg-current/25"
            >
              <Play className="mr-1 inline h-4 w-4" /> Deal next hand
            </button>
          </div>
        )}

        {occupied.length < 2 && (
          <p className="mt-3 text-center text-sm opacity-70">
            Waiting for at least 2 players ({humans.length} seated) — or fill the empty seats with
            bots.
          </p>
        )}
        {occupied.length < 2 && emptySeats > 0 && (
          <button
            type="button"
            onClick={async () => {
              await fill({ data: { tableId, count: emptySeats } });
              void queryClient.invalidateQueries({ queryKey: key });
            }}
            className="mt-2 w-full rounded-xl border border-current/30 bg-current/5 px-3 py-2 text-sm font-semibold hover:bg-current/10"
          >
            <Bot className="mr-1 inline h-4 w-4" /> Add bots
          </button>
        )}

        <p className="mt-4 text-center text-[11px] opacity-60">
          Free play chips only. Nothing here can be bought, won or cashed out.
        </p>
      </div>
    </div>
  );
}
