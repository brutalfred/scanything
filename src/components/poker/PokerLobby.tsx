import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Users } from "lucide-react";
import { createPokerTable, getPokerLobby, joinPokerTable } from "@/lib/poker.functions";

export function PokerLobby({ onEnter }: { onEnter: (tableId: string) => void }) {
  const queryClient = useQueryClient();
  const fetchLobby = useServerFn(getPokerLobby);
  const create = useServerFn(createPokerTable);
  const join = useServerFn(joinPokerTable);

  const [busy, setBusy] = useState(false);
  const [seats, setSeats] = useState(4);
  const [name, setName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["poker-lobby"],
    queryFn: () => fetchLobby(),
    refetchInterval: 5000,
  });

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      void queryClient.invalidateQueries({ queryKey: ["poker-lobby"] });
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="theme-panel gold-glow rounded-2xl p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Tables</h2>
          <span className="rounded-full border border-current/30 px-3 py-1 text-xs tabular-nums">
            {data?.chips ?? 0} play chips
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
            placeholder="Table name"
            className="flex-1 rounded-xl border border-current/30 bg-current/5 px-3 py-2 text-sm outline-none focus:border-current/60"
          />
          <select
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
            className="rounded-xl border border-current/30 bg-current/5 px-3 py-2 text-sm outline-none"
          >
            {[2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} seats
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const res = await create({ data: { name, maxSeats: seats, solo: false } });
                onEnter(res.tableId);
              })
            }
            className="rounded-xl border border-current bg-current/15 px-4 py-2 text-sm font-semibold hover:bg-current/25"
          >
            <Plus className="mr-1 inline h-4 w-4" /> Create table
          </button>
        </div>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const res = await create({ data: { solo: true } });
              onEnter(res.tableId);
            })
          }
          className="mt-2 w-full rounded-xl border border-current/30 bg-current/5 px-4 py-2 text-sm font-semibold hover:bg-current/10"
        >
          Play solo against 3 bots
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {isLoading && (
          <li className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin" />
          </li>
        )}
        {!isLoading && (data?.tables.length ?? 0) === 0 && (
          <li className="theme-panel rounded-2xl p-4 text-center text-sm opacity-70">
            No open tables yet — create one and invite a friend.
          </li>
        )}
        {(data?.tables ?? []).map((t) => (
          <li
            key={t.id}
            className="theme-panel flex items-center justify-between gap-3 rounded-2xl p-3 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold">{t.name}</p>
              <p className="text-xs opacity-70">
                Blinds {t.smallBlind}/{t.bigBlind} · {t.status}
              </p>
            </div>
            <span className="flex items-center gap-1 text-xs tabular-nums opacity-80">
              <Users className="h-3.5 w-3.5" />
              {t.seated}/{t.maxSeats}
            </span>
            <button
              type="button"
              disabled={busy || t.seated >= t.maxSeats}
              onClick={() =>
                run(async () => {
                  await join({ data: { tableId: t.id } });
                  onEnter(t.id);
                })
              }
              className="rounded-xl border border-current/40 bg-current/10 px-3 py-2 text-xs font-semibold hover:bg-current/20 disabled:opacity-40"
            >
              {t.seated >= t.maxSeats ? "Full" : "Join"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
