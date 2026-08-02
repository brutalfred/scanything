CREATE TABLE public.daily_free_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scan_date)
);

GRANT SELECT ON public.daily_free_scans TO authenticated;
GRANT ALL ON public.daily_free_scans TO service_role;

ALTER TABLE public.daily_free_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own free scans"
ON public.daily_free_scans FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.claim_free_scan_for(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  BEGIN
    INSERT INTO public.daily_free_scans (user_id, scan_date)
    VALUES (_user_id, (now() AT TIME ZONE 'UTC')::date);
  EXCEPTION WHEN unique_violation THEN
    RETURN false;
  END;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_free_scan_for(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  DELETE FROM public.daily_free_scans
   WHERE user_id = _user_id AND scan_date = (now() AT TIME ZONE 'UTC')::date;
$$;

DROP FUNCTION IF EXISTS public.get_credit_state_for(uuid);

CREATE FUNCTION public.get_credit_state_for(_user_id uuid)
RETURNS TABLE(balance integer, last_daily_grant_at timestamp with time zone, free_scan_available boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  acct public.credit_accounts;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'no_user';
  END IF;
  acct := public.ensure_credit_account(_user_id);
  balance := acct.balance;
  last_daily_grant_at := acct.last_daily_grant_at;
  free_scan_available := NOT EXISTS (
    SELECT 1 FROM public.daily_free_scans
     WHERE user_id = _user_id AND scan_date = (now() AT TIME ZONE 'UTC')::date
  );
  RETURN NEXT;
END;
$$;