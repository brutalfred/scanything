import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getCreditState,
  claimSignupGrant,
  type CreditState,
} from "@/lib/credits.functions";
import { getDeviceHash } from "@/lib/device-id";
import { CREDIT_COSTS, type CreditReason } from "@/lib/credits";


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

  // One-time free trial grant, limited to one per device.
  const [trialNotice, setTrialNotice] = useState<string | null>(null);
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) return;
    const key = `scanything.trial.claimed.${userId}`;
    if (localStorage.getItem(key)) return;
    let cancelled = false;
    (async () => {
      try {
        const deviceHash = await getDeviceHash();
        const result = await claimSignupGrant({ data: { deviceHash } });
        if (cancelled) return;
        localStorage.setItem(key, "1");
        // Optimistically reflect the new balance in the counter immediately.
        queryClient.setQueryData<CreditState>(["credits"], (prev) => ({
          balance: result.balance,
          lastDailyGrantAt: prev?.lastDailyGrantAt ?? null,
          freeScanAvailable: prev?.freeScanAvailable ?? true,
          ledger: prev?.ledger ?? [],
        }));
        if (result.status === "granted") {
          toast.success(`${result.balance} free trial credits added — enjoy!`);
        } else if (result.status === "device_used") {
          setTrialNotice(
            "The free trial has already been used on this device. Buy credits to keep scanning.",
          );
        } else if (result.status === "blocked_email") {
          setTrialNotice(
            "Free trial credits aren't available for temporary email addresses. Buy credits to keep scanning.",
          );
        }
        queryClient.invalidateQueries({ queryKey: ["credits"] });
      } catch {
        // Network hiccup — try again on the next sign-in.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user.id, queryClient]);


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
      queryClient.setQueryData<CreditState>(["credits"], (prev) => {
        if (!prev) return prev;
        return { ...prev, balance: Math.max(0, prev.balance - cost) };
      });
    },
    [signedIn, queryClient],
  );


  return {
    balance,
    signedIn,
    sessionReady,
    userId: session?.user.id ?? null,
    email: session?.user.email ?? null,
    ledger: query.data?.ledger ?? [],
    lastDailyGrantAt: query.data?.lastDailyGrantAt ?? null,
    freeScanAvailable,
    trialNotice,
    dismissTrialNotice: () => setTrialNotice(null),
    loading: signedIn && query.isLoading,
    canAfford,
    noteSpend,
    refresh,
  };
}

export type CreditsApi = ReturnType<typeof useCredits>;
