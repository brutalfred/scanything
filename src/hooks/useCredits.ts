import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getCreditState,
  getAdRewardStatus,
  claimAdReward,
  startAdSession,
} from "@/lib/credits.functions";
import { AD_DAILY_LIMIT } from "@/lib/credit-packs";
import { CREDIT_COSTS, type CreditReason } from "@/lib/credits";
import { adErrorMessage } from "@/lib/ad-errors";

export function useCredits() {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signedIn = Boolean(session);

  const query = useQuery({
    queryKey: ["credits"],
    queryFn: () => getCreditState(),
    enabled: signedIn,
    staleTime: 15_000,
  });

  const balance = signedIn ? (query.data?.balance ?? 0) : 0;

  const refresh = useCallback(() => {
    if (signedIn) queryClient.invalidateQueries({ queryKey: ["credits"] });
  }, [signedIn, queryClient]);

  const canAfford = useCallback(
    (reason: CreditReason) => balance >= CREDIT_COSTS[reason],
    [balance],
  );

  /** Optimistically records a spend locally. The server is the source of truth for signed-in users. */
  const noteSpend = useCallback(
    (reason: CreditReason) => {
      const cost = CREDIT_COSTS[reason];
      if (!signedIn) return;
      queryClient.setQueryData(["credits"], (prev: typeof query.data) =>
        prev ? { ...prev, balance: Math.max(0, prev.balance - cost) } : prev,
      );
    },
    [signedIn, queryClient, query.data],
  );

  const adQuery = useQuery({
    queryKey: ["ad-reward-status"],
    queryFn: () => getAdRewardStatus(),
    enabled: signedIn,
    staleTime: 30_000,
  });

  const startAd = useCallback(async () => {
    const { sessionId } = await startAdSession();
    return sessionId;
  }, []);

  const claimAd = useCallback(
    async (sessionId: string) => {
      try {
        const result = await claimAdReward({ data: { sessionId } });
        queryClient.setQueryData(["credits"], (prev: typeof query.data) =>
          prev ? { ...prev, balance: result.balance } : prev,
        );
        queryClient.invalidateQueries({ queryKey: ["credits"] });
        queryClient.invalidateQueries({ queryKey: ["ad-reward-status"] });
        toast.success("Credits added — enjoy your free scan");
      } catch (e) {
        toast.error(adErrorMessage(e));
      }
    },
    [queryClient, query.data],
  );


  return {
    balance,
    signedIn,
    sessionReady,
    userId: session?.user.id ?? null,
    email: session?.user.email ?? null,
    ledger: query.data?.ledger ?? [],
    lastDailyGrantAt: query.data?.lastDailyGrantAt ?? null,
    loading: signedIn && query.isLoading,
    adClaimsToday: adQuery.data?.claimsToday ?? 0,
    adDailyLimit: adQuery.data?.dailyLimit ?? AD_DAILY_LIMIT,
    claimAdReward: claimAd,
    canAfford,
    noteSpend,
    refresh,
  };
}

export type CreditsApi = ReturnType<typeof useCredits>;

