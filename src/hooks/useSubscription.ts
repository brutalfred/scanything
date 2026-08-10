import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPaddleEnvironment } from "@/lib/paddle";
import { getActiveSubscription, type ActiveSubscription } from "@/lib/subscription.functions";
import type { PlanType } from "@/lib/plan-mapping";

export function useSubscription(enabled = true) {
  const environment = getPaddleEnvironment();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["subscription", environment],
    queryFn: async () => {
      const row = await getActiveSubscription({ data: { environment } });
      return (row ?? null) as ActiveSubscription | null;
    },
    enabled,
    staleTime: 30_000,
  });

  const plan: PlanType | null = useMemo(() => {
    const p = data?.plan;
    if (p === "max") return "max";
    if (p === "pro") return "pro";
    return null;
  }, [data?.plan]);

  return {
    subscription: data,
    isLoading,
    refetch,
    isPro: plan === "pro" || plan === "max",
    isMax: plan === "max",
    plan,
  };
}
