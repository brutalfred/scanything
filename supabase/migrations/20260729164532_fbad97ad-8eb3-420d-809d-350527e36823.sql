CREATE TABLE public.credit_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  paddle_transaction_id text NOT NULL UNIQUE,
  price_id text NOT NULL,
  credits integer NOT NULL,
  amount_cents integer,
  currency text,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.credit_purchases TO authenticated;
GRANT ALL ON public.credit_purchases TO service_role;

ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases"
  ON public.credit_purchases FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_credit_purchases_user ON public.credit_purchases(user_id);

CREATE TABLE public.ad_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  credits integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ad_reward_claims TO authenticated;
GRANT ALL ON public.ad_reward_claims TO service_role;

ALTER TABLE public.ad_reward_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ad rewards"
  ON public.ad_reward_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_ad_reward_claims_user_day ON public.ad_reward_claims(user_id, created_at);

CREATE OR REPLACE FUNCTION public.claim_ad_reward()
RETURNS TABLE(balance integer, claims_today integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  reward constant integer := 2;
  daily_limit constant integer := 5;
  used integer;
  new_balance integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  PERFORM public.ensure_credit_account(auth.uid());

  SELECT count(*) INTO used
  FROM public.ad_reward_claims
  WHERE user_id = auth.uid()
    AND created_at >= date_trunc('day', now());

  IF used >= daily_limit THEN
    RAISE EXCEPTION 'ad_limit_reached';
  END IF;

  INSERT INTO public.ad_reward_claims (user_id, credits)
  VALUES (auth.uid(), reward);

  UPDATE public.credit_accounts
  SET balance = balance + reward, updated_at = now()
  WHERE user_id = auth.uid()
  RETURNING credit_accounts.balance INTO new_balance;

  INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
  VALUES (auth.uid(), reward, 'ad_reward', '{}'::jsonb);

  balance := new_balance;
  claims_today := used + 1;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_ad_reward_status()
RETURNS TABLE(claims_today integer, daily_limit integer, reward integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT count(*)::integer FROM public.ad_reward_claims
      WHERE user_id = auth.uid() AND created_at >= date_trunc('day', now())),
    5,
    2;
$$;

REVOKE ALL ON FUNCTION public.grant_credits(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_credits(uuid, integer, text) TO service_role;
REVOKE ALL ON FUNCTION public.refund_credits(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_ad_reward() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_ad_reward_status() TO authenticated;