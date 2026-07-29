CREATE TABLE public.credit_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  last_daily_grant_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.credit_accounts TO authenticated;
GRANT ALL ON public.credit_accounts TO service_role;
ALTER TABLE public.credit_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own credit account" ON public.credit_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX credit_ledger_user_created_idx ON public.credit_ledger (user_id, created_at DESC);

GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own credit ledger" ON public.credit_ledger
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Ensures an account exists, applies the daily top-up if due.
CREATE OR REPLACE FUNCTION public.ensure_credit_account(_user_id uuid)
RETURNS public.credit_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acct public.credit_accounts;
  starting_grant constant integer := 100;
  daily_floor constant integer := 25;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'no_user';
  END IF;

  SELECT * INTO acct FROM public.credit_accounts WHERE user_id = _user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.credit_accounts (user_id, balance, last_daily_grant_at)
    VALUES (_user_id, starting_grant, now())
    RETURNING * INTO acct;

    INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
    VALUES (_user_id, starting_grant, 'signup_grant', '{}'::jsonb);

    RETURN acct;
  END IF;

  IF acct.last_daily_grant_at IS NULL OR acct.last_daily_grant_at < date_trunc('day', now()) THEN
    IF acct.balance < daily_floor THEN
      INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
      VALUES (_user_id, daily_floor - acct.balance, 'daily_grant', '{}'::jsonb);

      UPDATE public.credit_accounts
      SET balance = daily_floor, last_daily_grant_at = now(), updated_at = now()
      WHERE user_id = _user_id
      RETURNING * INTO acct;
    ELSE
      UPDATE public.credit_accounts
      SET last_daily_grant_at = now(), updated_at = now()
      WHERE user_id = _user_id
      RETURNING * INTO acct;
    END IF;
  END IF;

  RETURN acct;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_credit_state()
RETURNS TABLE (balance integer, last_daily_grant_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acct public.credit_accounts;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  acct := public.ensure_credit_account(auth.uid());
  balance := acct.balance;
  last_daily_grant_at := acct.last_daily_grant_at;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.spend_credits(_amount integer, _reason text, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acct public.credit_accounts;
  new_balance integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 1000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  acct := public.ensure_credit_account(auth.uid());

  IF acct.balance < _amount THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  UPDATE public.credit_accounts
  SET balance = balance - _amount, updated_at = now()
  WHERE user_id = auth.uid()
  RETURNING balance INTO new_balance;

  INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
  VALUES (auth.uid(), -_amount, coalesce(_reason, 'spend'), coalesce(_metadata, '{}'::jsonb));

  RETURN new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_credits(_amount integer, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 1000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  UPDATE public.credit_accounts
  SET balance = balance + _amount, updated_at = now()
  WHERE user_id = auth.uid()
  RETURNING balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'no_account';
  END IF;

  INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
  VALUES (auth.uid(), _amount, coalesce(_reason, 'refund'), '{}'::jsonb);

  RETURN new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_credits(_user_id uuid, _amount integer, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance integer;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  PERFORM public.ensure_credit_account(_user_id);

  UPDATE public.credit_accounts
  SET balance = balance + _amount, updated_at = now()
  WHERE user_id = _user_id
  RETURNING balance INTO new_balance;

  INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
  VALUES (_user_id, _amount, coalesce(_reason, 'grant'), '{}'::jsonb);

  RETURN new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_credit_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_credits(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_credit_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credits(integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(integer, text) TO authenticated;