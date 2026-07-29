-- Drop the old function first so we can change its return type.
DROP FUNCTION IF EXISTS public.get_scan_economics(integer);

-- Recreate it with only AI cost columns.
CREATE OR REPLACE FUNCTION public.get_scan_economics(_days integer DEFAULT 30)
 RETURNS TABLE(scans integer, avg_scan_cost_micro_usd integer, total_cost_micro_usd bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = 'public'
AS $function$
  SELECT
    (SELECT count(*)::integer FROM public.ai_usage
       WHERE action = 'photo_scan' AND created_at >= now() - (_days || ' days')::interval),
    (SELECT coalesce(avg(cost_micro_usd), 0)::integer FROM public.ai_usage
       WHERE action = 'photo_scan' AND created_at >= now() - (_days || ' days')::interval),
    (SELECT coalesce(sum(cost_micro_usd), 0)::bigint FROM public.ai_usage
       WHERE created_at >= now() - (_days || ' days')::interval);
$function$;

-- Remove ad reward tables.
DROP TABLE IF EXISTS public.ad_reward_claims;
DROP TABLE IF EXISTS public.ad_sessions;

-- Remove ad reward functions.
DROP FUNCTION IF EXISTS public.start_ad_session();
DROP FUNCTION IF EXISTS public.claim_ad_reward(_session_id uuid);
DROP FUNCTION IF EXISTS public.get_ad_reward_status();