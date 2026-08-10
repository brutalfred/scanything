CREATE OR REPLACE FUNCTION public.get_active_user_plan(_user_id uuid, _env text default 'live')
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT plan FROM (
    SELECT plan FROM public.subscriptions
    WHERE user_id = _user_id AND environment = _env AND (
      (status in ('active', 'trialing') and (current_period_end is null or current_period_end > now()))
      or (status = 'canceled' and current_period_end > now())
    )
    UNION ALL
    SELECT plan FROM public.play_subscriptions
    WHERE user_id = _user_id AND environment = _env AND (
      (status in ('active', 'trialing') and (current_period_end is null or current_period_end > now()))
      or (status = 'canceled' and current_period_end > now())
    )
  ) combined
  ORDER BY CASE plan WHEN 'max' THEN 1 WHEN 'pro' THEN 2 ELSE 3 END
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_active_subscription(user_uuid uuid, check_env text default 'live')
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.get_active_user_plan(user_uuid, check_env) IS NOT NULL;
$$;
