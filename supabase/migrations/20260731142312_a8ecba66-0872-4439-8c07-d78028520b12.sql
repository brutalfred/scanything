CREATE TABLE public.play_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  purchase_token text NOT NULL UNIQUE,
  product_id text NOT NULL,
  order_id text,
  credits integer NOT NULL,
  state text NOT NULL DEFAULT 'granted',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.play_purchases TO authenticated;
GRANT ALL ON public.play_purchases TO service_role;

ALTER TABLE public.play_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own play purchases"
ON public.play_purchases FOR SELECT TO authenticated
USING (auth.uid() = user_id);

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
  IF _purchase_token IS NULL OR length(_purchase_token) < 8 THEN RAISE EXCEPTION 'invalid_token'; END IF;
  IF _credits IS NULL OR _credits <= 0 OR _credits > 100000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  PERFORM public.ensure_credit_account(_user_id);

  BEGIN
    INSERT INTO public.play_purchases (user_id, purchase_token, product_id, order_id, credits)
    VALUES (_user_id, _purchase_token, _product_id, _order_id, _credits);
  EXCEPTION WHEN unique_violation THEN
    SELECT ca.balance INTO new_balance FROM public.credit_accounts ca WHERE ca.user_id = _user_id;
    status := 'already_redeemed';
    balance := coalesce(new_balance, 0);
    RETURN NEXT;
    RETURN;
  END;

  new_balance := public.grant_credits(_user_id, _credits, 'purchase:google_play:' || _product_id);

  status := 'granted';
  balance := new_balance;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_play_purchase(uuid, text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_play_purchase(uuid, text, text, text, integer) TO service_role;