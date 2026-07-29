REVOKE ALL ON FUNCTION public.refund_credits(integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits(integer, text) TO service_role;

CREATE OR REPLACE FUNCTION public.refund_credits_for(_user_id uuid, _amount integer, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_balance integer;
BEGIN
  IF _user_id IS NULL OR _amount IS NULL OR _amount <= 0 OR _amount > 1000 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  UPDATE public.credit_accounts
  SET balance = balance + _amount, updated_at = now()
  WHERE user_id = _user_id
  RETURNING balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'no_account';
  END IF;

  INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
  VALUES (_user_id, _amount, coalesce(_reason, 'refund'), '{}'::jsonb);

  RETURN new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.refund_credits_for(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refund_credits_for(uuid, integer, text) TO service_role;