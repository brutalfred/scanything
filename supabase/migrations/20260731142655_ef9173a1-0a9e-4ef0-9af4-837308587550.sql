CREATE OR REPLACE FUNCTION public.redeem_play_purchase(
  _user_id uuid,
  _purchase_token text,
  _product_id text,
  _order_id text,
  _credits integer
)
RETURNS TABLE(status text, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_balance integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _credits IS NULL OR _credits <= 0 OR _credits > 100000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF _purchase_token IS NULL OR length(_purchase_token) < 8 THEN RAISE EXCEPTION 'invalid_token'; END IF;

  PERFORM public.ensure_credit_account(_user_id);

  BEGIN
    INSERT INTO public.play_purchases (user_id, purchase_token, product_id, order_id, credits)
    VALUES (_user_id, _purchase_token, _product_id, nullif(_order_id, ''), _credits);
  EXCEPTION WHEN unique_violation THEN
    SELECT ca.balance INTO new_balance FROM public.credit_accounts ca WHERE ca.user_id = _user_id;
    status := 'already_redeemed';
    balance := coalesce(new_balance, 0);
    RETURN NEXT;
    RETURN;
  END;

  new_balance := public.grant_credits(_user_id, _credits, 'purchase:' || _product_id);

  status := 'granted';
  balance := new_balance;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_play_purchase(uuid, text, text, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_play_purchase(uuid, text, text, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.redeem_play_purchase(uuid, text, text, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_play_purchase(uuid, text, text, text, integer) TO service_role;