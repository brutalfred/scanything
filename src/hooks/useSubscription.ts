import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPaddleEnvironment } from "@/lib/paddle";
import { getActiveSubscription, type SubscriptionRow } from "@/lib/subscription.functions";

export function useSubscription(enabled = true) {
  const environment = getPaddleEnvironment();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["subscription", environment],
    queryFn: async () => {
      const row = await getActiveSubscription({ data: { environment } });
      return (row ?? null) as SubscriptionRow | null;
    },
    enabled,
    staleTime: 30_000,
  });

  const isPro = useMemo(() => isActive(data ?? null), [data]);

  return {
    subscription: data,
    isLoading,
    refetch,
    isPro,
  };
}

function isActive(row: SubscriptionRow | null): boolean {
  if (!row) return false;
  const grace = row.status === "canceled" && row.current_period_end
    ? new Date(row.current_period_end).getTime() > Date.now()
    : false;
  const live = ["active", "trialing"].includes(row.status) && (!row.current_period_end || new Date(row.current_period_end).getTime() > Date.now());
  return live || grace;
}
