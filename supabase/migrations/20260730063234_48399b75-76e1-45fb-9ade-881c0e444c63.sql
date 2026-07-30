-- Service-role-only variants keyed on a server-verified user id
CREATE OR REPLACE FUNCTION public.get_credit_state_for(_user_id uuid)
RETURNS TABLE(balance integer, last_daily_grant_at timestamp with time zone)
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
  acct := public.ensure_credit_account(_user_id);
  balance := acct.balance;
  last_daily_grant_at := acct.last_daily_grant_at;
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.spend_credits_for(_user_id uuid, _amount integer, _reason text, _metadata jsonb DEFAULT '{}'::jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  acct public.credit_accounts;
  new_balance integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 1000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  acct := public.ensure_credit_account(_user_id);

  IF acct.balance < _amount THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  UPDATE public.credit_accounts
  SET balance = balance - _amount, updated_at = now()
  WHERE user_id = _user_id
  RETURNING balance INTO new_balance;

  INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
  VALUES (_user_id, -_amount, coalesce(_reason, 'spend'), coalesce(_metadata, '{}'::jsonb));

  RETURN new_balance;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_signup_grant_for(_user_id uuid, _device_hash text)
RETURNS TABLE(status text, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  signup_grant constant integer := 5;
  acct public.credit_accounts;
  already_granted boolean;
  new_balance integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _device_hash IS NULL OR length(_device_hash) < 16 OR length(_device_hash) > 128 THEN
    RAISE EXCEPTION 'invalid_device';
  END IF;

  acct := public.ensure_credit_account(_user_id);

  SELECT EXISTS (
    SELECT 1 FROM public.credit_ledger
    WHERE user_id = _user_id AND reason = 'signup_grant'
  ) INTO already_granted;

  IF already_granted THEN
    status := 'already_claimed';
    balance := acct.balance;
    RETURN NEXT;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.device_grants (device_hash, user_id) VALUES (_device_hash, _user_id);
  EXCEPTION WHEN unique_violation THEN
    status := 'device_used';
    balance := acct.balance;
    RETURN NEXT;
    RETURN;
  END;

  UPDATE public.credit_accounts
  SET balance = credit_accounts.balance + signup_grant, updated_at = now()
  WHERE user_id = _user_id
  RETURNING credit_accounts.balance INTO new_balance;

  INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
  VALUES (_user_id, signup_grant, 'signup_grant', '{}'::jsonb);

  status := 'granted';
  balance := new_balance;
  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_credit_state_for(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.spend_credits_for(uuid, integer, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_signup_grant_for(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_credit_state_for(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.spend_credits_for(uuid, integer, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_signup_grant_for(uuid, text) TO service_role;

-- Drop the client-callable SECURITY DEFINER entry points
DROP FUNCTION IF EXISTS public.get_credit_state();
DROP FUNCTION IF EXISTS public.spend_credits(integer, text, jsonb);
DROP FUNCTION IF EXISTS public.claim_signup_grant(text);
DROP FUNCTION IF EXISTS public.refund_credits(integer, text);

-- Role checks are performed by trusted server code with a verified user id
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;