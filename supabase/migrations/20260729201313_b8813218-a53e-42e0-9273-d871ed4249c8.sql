CREATE TABLE public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  cost_micro_usd integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ai usage"
  ON public.ai_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX ai_usage_action_created_idx ON public.ai_usage (action, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_scan_economics(_days integer DEFAULT 30)
RETURNS TABLE(
  scans integer,
  avg_scan_cost_micro_usd integer,
  total_cost_micro_usd bigint,
  ads_watched integer,
  ad_credits_granted integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    (SELECT count(*)::integer FROM public.ai_usage
       WHERE action = 'photo_scan' AND created_at >= now() - (_days || ' days')::interval),
    (SELECT coalesce(avg(cost_micro_usd), 0)::integer FROM public.ai_usage
       WHERE action = 'photo_scan' AND created_at >= now() - (_days || ' days')::interval),
    (SELECT coalesce(sum(cost_micro_usd), 0)::bigint FROM public.ai_usage
       WHERE created_at >= now() - (_days || ' days')::interval),
    (SELECT count(*)::integer FROM public.ad_reward_claims
       WHERE created_at >= now() - (_days || ' days')::interval),
    (SELECT coalesce(sum(credits), 0)::integer FROM public.ad_reward_claims
       WHERE created_at >= now() - (_days || ' days')::interval);
$function$;

REVOKE ALL ON FUNCTION public.get_scan_economics(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_scan_economics(integer) TO service_role;