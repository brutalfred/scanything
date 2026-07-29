CREATE OR REPLACE FUNCTION public.ensure_credit_account(_user_id uuid)
RETURNS public.credit_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acct public.credit_accounts;
  starting_grant constant integer := 5;
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