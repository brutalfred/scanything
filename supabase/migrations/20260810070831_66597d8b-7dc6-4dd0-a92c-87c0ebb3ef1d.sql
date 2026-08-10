ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan text;

CREATE TABLE public.play_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  product_id text not null,
  purchase_token text not null unique,
  order_id text,
  plan text not null,
  status text not null default 'active',
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  environment text not null default 'sandbox',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

GRANT SELECT ON public.play_subscriptions TO authenticated;
GRANT ALL ON public.play_subscriptions TO service_role;

ALTER TABLE public.play_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own play subscriptions"
  ON public.play_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_play_subscriptions_user_id ON public.play_subscriptions(user_id);
CREATE INDEX idx_play_subscriptions_purchase_token ON public.play_subscriptions(purchase_token);

CREATE OR REPLACE FUNCTION public.get_active_user_plan(_user_id uuid, _env text default 'live')
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
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
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_active_user_plan(user_uuid, check_env) IS NOT NULL;
$$;
