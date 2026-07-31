CREATE TABLE IF NOT EXISTS public.ad_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credits integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ad_reward_claims TO authenticated;
GRANT ALL ON public.ad_reward_claims TO service_role;

ALTER TABLE public.ad_reward_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own ad reward claims" ON public.ad_reward_claims;
CREATE POLICY "Users view own ad reward claims"
  ON public.ad_reward_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ad_reward_claims_user_day ON public.ad_reward_claims(user_id, created_at);

CREATE OR REPLACE FUNCTION public.claim_ad_reward_for(_user_id uuid)
RETURNS TABLE(status text, balance integer, claims_today integer, daily_limit integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  reward constant integer := 1;
  max_per_day constant integer := 5;
  used integer;
  new_balance integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  PERFORM public.ensure_credit_account(_user_id);

  SELECT count(*)::integer INTO used
  FROM public.ad_reward_claims
  WHERE user_id = _user_id AND created_at >= date_trunc('day', now());

  IF used >= max_per_day THEN
    SELECT ca.balance INTO new_balance FROM public.credit_accounts ca WHERE ca.user_id = _user_id;
    status := 'limit_reached';
    balance := coalesce(new_balance, 0);
    claims_today := used;
    daily_limit := max_per_day;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.ad_reward_claims (user_id, credits) VALUES (_user_id, reward);
  new_balance := public.grant_credits(_user_id, reward, 'ad_reward');

  status := 'granted';
  balance := new_balance;
  claims_today := used + 1;
  daily_limit := max_per_day;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_ad_reward_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ad_reward_for(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.get_ad_reward_status_for(_user_id uuid)
RETURNS TABLE(claims_today integer, daily_limit integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT count(*)::integer INTO claims_today
  FROM public.ad_reward_claims
  WHERE user_id = _user_id AND created_at >= date_trunc('day', now());
  daily_limit := 5;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_ad_reward_status_for(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ad_reward_status_for(uuid) TO service_role;