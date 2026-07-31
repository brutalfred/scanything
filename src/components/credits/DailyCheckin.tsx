import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Flame } from "lucide-react";
import { toast } from "sonner";
import {
  CHECKIN_GOAL,
  CHECKIN_REWARD,
  claimDailyCheckin,
  getCheckinState,
} from "@/lib/checkin.functions";
import { playSound } from "@/lib/sounds";


export function DailyCheckin({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();

  const state = useQuery({
    queryKey: ["checkin"],
    queryFn: () => getCheckinState(),
    enabled,
    staleTime: 30_000,
  });

  const claim = useMutation({
    mutationFn: () => claimDailyCheckin(),
    onSuccess: (result) => {
      if (result.status === "rewarded") {
        void playSound("coin");
        toast.success(`${CHECKIN_GOAL} days in a row — ${result.rewarded} credits added!`);
      } else if (result.status === "already_checked_in") {
        toast.info("You've already checked in today");
      } else {
        void playSound("coin");
        toast.success(`Checked in — day ${result.currentStreak} of ${CHECKIN_GOAL}`);
      }

      queryClient.invalidateQueries({ queryKey: ["checkin"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
    onError: () => toast.error("Could not check in — please try again"),
  });

  const streak = state.data?.currentStreak ?? 0;
  const done = state.data?.checkedInToday ?? false;

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
          Daily check-in
        </p>
        <span className="inline-flex items-center gap-1 text-xs opacity-70">
          <Flame className="h-3.5 w-3.5" />
          {state.isLoading ? "…" : `${streak}/${CHECKIN_GOAL}`}
        </span>
      </div>

      <div className="mt-2 flex gap-1.5">
        {Array.from({ length: CHECKIN_GOAL }).map((_, i) => (
          <span
            key={i}
            className={`h-2 flex-1 rounded-full border border-current/30 ${
              i < streak ? "bg-current" : "bg-current/10"
            }`}
          />
        ))}
      </div>

      <button
        type="button"
        disabled={!enabled || done || claim.isPending || state.isLoading}
        onClick={() => claim.mutate()}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-current/30 bg-current/5 px-3 py-2 font-semibold transition-colors hover:bg-current/10 disabled:opacity-50"
      >
        <CalendarCheck className="h-4 w-4" />
        {done ? "Checked in today" : claim.isPending ? "Checking in…" : "Check in"}
      </button>

      <p className="mt-2 text-center text-[11px] opacity-60">
        {CHECKIN_GOAL} days in a row = {CHECKIN_REWARD} credits
      </p>
    </div>
  );
}
