CREATE TABLE IF NOT EXISTS public.account_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  visit_date date not null default ((now() AT TIME ZONE 'UTC')::date),
  created_at timestamptz not null default now(),
  unique (user_id, visit_date)
);

GRANT SELECT ON public.account_visits TO authenticated;
GRANT ALL ON public.account_visits TO service_role;
ALTER TABLE public.account_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own visits" ON public.account_visits FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.record_account_visit(_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.account_visits (user_id) VALUES (_user_id)
  ON CONFLICT (user_id, visit_date) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_usage_stats()
RETURNS TABLE(
  visitors_today integer, visitors_week integer, visitors_month integer,
  scans_today integer, scans_week integer, scans_month integer,
  revenue_month_cents integer, purchases_month integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (SELECT count(DISTINCT user_id)::integer FROM public.account_visits WHERE visit_date = (now() AT TIME ZONE 'UTC')::date),
    (SELECT count(DISTINCT user_id)::integer FROM public.account_visits WHERE visit_date >= date_trunc('week', (now() AT TIME ZONE 'UTC'))::date),
    (SELECT count(DISTINCT user_id)::integer FROM public.account_visits WHERE visit_date >= date_trunc('month', (now() AT TIME ZONE 'UTC'))::date),
    (SELECT count(*)::integer FROM public.ai_usage WHERE action IN ('photo_scan','quick_scan','document_scan') AND created_at >= date_trunc('day', now() AT TIME ZONE 'UTC')),
    (SELECT count(*)::integer FROM public.ai_usage WHERE action IN ('photo_scan','quick_scan','document_scan') AND created_at >= date_trunc('week', now() AT TIME ZONE 'UTC')),
    (SELECT count(*)::integer FROM public.ai_usage WHERE action IN ('photo_scan','quick_scan','document_scan') AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC')),
    (SELECT coalesce(sum(amount_cents),0)::integer FROM public.credit_purchases WHERE environment = 'live' AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC')),
    (SELECT count(*)::integer FROM public.credit_purchases WHERE environment = 'live' AND created_at >= date_trunc('month', now() AT TIME ZONE 'UTC'));
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_usage_stats() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_account_visit(uuid) FROM anon, authenticated;