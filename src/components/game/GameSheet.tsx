import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, X } from "lucide-react";
import { getGameLeaderboard, submitGameScore } from "@/lib/game.functions";
import { HurdlesGame, formatTime } from "./HurdlesGame";

const NAME_KEY = "scanything:game-name";

function maskEmail(email: string | null) {
  if (!email) return "Runner";
  const local = email.split("@")[0] ?? "Runner";
  if (local.length <= 3) return local;
  return local.slice(0, 3) + "***";
}

function daysLeftInMonth() {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 86_400_000));
}

export function GameSheet({
  open,
  onClose,
  email,
}: {
  open: boolean;
  onClose: () => void;
  email: string | null;
}) {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<"month" | "alltime">("month");
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [resultLine, setResultLine] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(NAME_KEY);
    setName(saved || maskEmail(email));
  }, [email]);

  const limit = expanded ? 50 : 10;

  const board = useQuery({
    queryKey: ["game-leaderboard", scope, limit],
    queryFn: () => getGameLeaderboard({ data: { scope, limit } }),
    enabled: open,
    staleTime: 15_000,
  });

  const submit = useMutation({
    mutationFn: (timeMs: number) =>
      submitGameScore({ data: { timeMs, displayName: name.trim() || "Runner" } }),
    onSuccess: (res) => {
      setResultLine(
        res.status === "no_improvement"
          ? `Finished — your best this month is still ${formatTime(res.bestMonthMs ?? 0)}`
          : `New monthly best: ${formatTime(res.bestMonthMs ?? 0)}!`,
      );
      void queryClient.invalidateQueries({ queryKey: ["game-leaderboard"] });
    },
    onError: () => setResultLine("Could not save that time."),
  });

  const daysLeft = useMemo(daysLeftInMonth, [open]);

  if (!open || typeof document === "undefined") return null;

  const rows = board.data ?? [];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Hurdles game"
        onClick={(e) => e.stopPropagation()}
        className="theme-panel gold-glow max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl p-5 text-sm shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-base font-semibold">
            <Trophy className="h-4 w-4" />
            400m Hurdles
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-destructive/50 text-destructive transition-colors hover:bg-destructive/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3">
          <HurdlesGame
            onFinish={(ms) => {
              setResultLine(null);
              submit.mutate(ms);
            }}
            submitting={submit.isPending}
            resultLine={resultLine}
          />
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-semibold uppercase tracking-wide opacity-70">
            Leaderboard name
          </span>
          <input
            value={name}
            maxLength={20}
            onChange={(e) => {
              setName(e.target.value);
              window.localStorage.setItem(NAME_KEY, e.target.value);
            }}
            className="mt-1 w-full rounded-xl border border-current/30 bg-current/5 px-3 py-2 text-sm outline-none focus:border-current/60"
            placeholder="Runner"
          />
        </label>

        <div className="mt-4 flex gap-2">
          {(["month", "alltime"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setScope(s);
                setExpanded(false);
              }}
              className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                scope === s ? "border-current bg-current/15" : "border-current/30 bg-current/5"
              }`}
            >
              {s === "month" ? "This month" : "All time"}
            </button>
          ))}
        </div>

        <p className="mt-2 text-center text-[11px] opacity-70">
          {scope === "month"
            ? `Monthly prizes: 1st 100 · 2nd 50 · 3rd 10 credits — ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`
            : "All-time board — no resets, no payouts"}
        </p>

        <ul className="mt-3 space-y-1">
          {board.isLoading && <li className="py-2 text-center opacity-70">Loading…</li>}
          {!board.isLoading && rows.length === 0 && (
            <li className="py-2 text-center opacity-70">No times yet — be the first!</li>
          )}
          {rows.map((r) => (
            <li
              key={`${r.rank}-${r.displayName}`}
              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-xs ${
                r.isMe ? "border border-current/50 bg-current/10 font-bold" : "bg-current/5"
              }`}
            >
              <span className="w-6 shrink-0 tabular-nums opacity-70">{r.rank}</span>
              <span className="flex-1 truncate">{r.displayName}</span>
              <span className="tabular-nums">{formatTime(r.timeMs)}</span>
            </li>
          ))}
        </ul>

        {rows.length >= 10 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 w-full rounded-xl border border-current/30 bg-current/5 px-3 py-2 text-xs font-semibold transition-colors hover:bg-current/10"
          >
            {expanded ? "Show top 10" : "Show top 50"}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
