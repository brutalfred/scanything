CREATE TABLE public.device_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.device_grants TO service_role;

ALTER TABLE public.device_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to device grants"
ON public.device_grants FOR SELECT TO authenticated USING (false);

-- Account creation no longer grants credits, and the daily floor top-up is removed.
CREATE OR REPLACE FUNCTION public.ensure_credit_account(_user_id uuid)
RETURNS credit_accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  acct public.credit_accounts;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'no_user';
  END IF;

  SELECT * INTO acct FROM public.credit_accounts WHERE user_id = _user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.credit_accounts (user_id, balance, last_daily_grant_at)
    VALUES (_user_id, 0, now())
    RETURNING * INTO acct;
  END IF;

  RETURN acct;
END;
$function$;

-- One-time signup grant, limited to one per device.
CREATE OR REPLACE FUNCTION public.claim_signup_grant(_device_hash text)
RETURNS TABLE(status text, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  signup_grant constant integer := 5;
  uid uuid := auth.uid();
  acct public.credit_accounts;
  already_granted boolean;
  new_balance integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _device_hash IS NULL OR length(_device_hash) < 16 OR length(_device_hash) > 128 THEN
    RAISE EXCEPTION 'invalid_device';
  END IF;

  acct := public.ensure_credit_account(uid);

  -- Already claimed by this user?
  SELECT EXISTS (
    SELECT 1 FROM public.credit_ledger
    WHERE user_id = uid AND reason = 'signup_grant'
  ) INTO already_granted;

  IF already_granted THEN
    status := 'already_claimed';
    balance := acct.balance;
    RETURN NEXT;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.device_grants (device_hash, user_id) VALUES (_device_hash, uid);
  EXCEPTION WHEN unique_violation THEN
    status := 'device_used';
    balance := acct.balance;
    RETURN NEXT;
    RETURN;
  END;

  UPDATE public.credit_accounts
  SET balance = credit_accounts.balance + signup_grant, updated_at = now()
  WHERE user_id = uid
  RETURNING credit_accounts.balance INTO new_balance;

  INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
  VALUES (uid, signup_grant, 'signup_grant', '{}'::jsonb);

  status := 'granted';
  balance := new_balance;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_signup_grant(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_signup_grant(text) TO authenticated;