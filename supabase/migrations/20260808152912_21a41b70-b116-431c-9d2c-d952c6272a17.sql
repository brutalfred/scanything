CREATE OR REPLACE FUNCTION public.claim_signup_grant_for(_user_id uuid, _device_hash text)
 RETURNS TABLE(status text, balance integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  signup_grant constant integer := 10;
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