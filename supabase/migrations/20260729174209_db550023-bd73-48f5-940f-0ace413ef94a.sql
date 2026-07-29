CREATE TABLE public.ad_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE INDEX idx_ad_sessions_user ON public.ad_sessions(user_id, created_at DESC);

GRANT SELECT ON public.ad_sessions TO authenticated;
GRANT ALL ON public.ad_sessions TO service_role;

ALTER TABLE public.ad_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ad sessions"
  ON public.ad_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.start_ad_session()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  daily_limit constant integer := 5;
  cooldown constant interval := interval '60 seconds';
  used integer;
  last_claim timestamptz;
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT count(*) INTO used
  FROM public.ad_reward_claims
  WHERE user_id = auth.uid()
    AND created_at >= date_trunc('day', now());

  IF used >= daily_limit THEN
    RAISE EXCEPTION 'ad_limit_reached';
  END IF;

  SELECT max(created_at) INTO last_claim
  FROM public.ad_reward_claims
  WHERE user_id = auth.uid();

  IF last_claim IS NOT NULL AND now() - last_claim < cooldown THEN
    RAISE EXCEPTION 'ad_cooldown';
  END IF;

  INSERT INTO public.ad_sessions (user_id) VALUES (auth.uid())
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.claim_ad_reward();

CREATE OR REPLACE FUNCTION public.claim_ad_reward(_session_id uuid)
RETURNS TABLE(balance integer, claims_today integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  reward constant integer := 2;
  daily_limit constant integer := 5;
  min_watch constant interval := interval '14 seconds';
  max_age constant interval := interval '10 minutes';
  cooldown constant interval := interval '60 seconds';
  sess public.ad_sessions;
  used integer;
  last_claim timestamptz;
  new_balance integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  PERFORM public.ensure_credit_account(auth.uid());

  -- Consume the session atomically: only an unused, owned session can be claimed.
  UPDATE public.ad_sessions
  SET used_at = now()
  WHERE id = _session_id
    AND user_id = auth.uid()
    AND used_at IS NULL
  RETURNING * INTO sess;

  IF sess.id IS NULL THEN
    RAISE EXCEPTION 'ad_session_invalid';
  END IF;

  IF now() - sess.created_at < min_watch THEN
    RAISE EXCEPTION 'ad_too_fast';
  END IF;

  IF now() - sess.created_at > max_age THEN
    RAISE EXCEPTION 'ad_session_invalid';
  END IF;

  SELECT count(*) INTO used
  FROM public.ad_reward_claims
  WHERE user_id = auth.uid()
    AND created_at >= date_trunc('day', now());

  IF used >= daily_limit THEN
    RAISE EXCEPTION 'ad_limit_reached';
  END IF;

  SELECT max(created_at) INTO last_claim
  FROM public.ad_reward_claims
  WHERE user_id = auth.uid();

  IF last_claim IS NOT NULL AND now() - last_claim < cooldown THEN
    RAISE EXCEPTION 'ad_cooldown';
  END IF;

  INSERT INTO public.ad_reward_claims (user_id, credits)
  VALUES (auth.uid(), reward);

  UPDATE public.credit_accounts
  SET balance = credit_accounts.balance + reward, updated_at = now()
  WHERE user_id = auth.uid()
  RETURNING credit_accounts.balance INTO new_balance;

  INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
  VALUES (auth.uid(), reward, 'ad_reward', jsonb_build_object('session_id', _session_id));

  balance := new_balance;
  claims_today := used + 1;
  RETURN NEXT;
END;
$function$;