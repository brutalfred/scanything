CREATE TABLE public.checkin_streaks (
  user_id uuid PRIMARY KEY,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_checkin_date date,
  total_rewards integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.checkin_streaks TO authenticated;
GRANT ALL ON public.checkin_streaks TO service_role;

ALTER TABLE public.checkin_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checkin streak"
ON public.checkin_streaks FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_checkin_state_for(_user_id uuid)
RETURNS TABLE(current_streak integer, longest_streak integer, last_checkin_date date, total_rewards integer, checked_in_today boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  row public.checkin_streaks;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO row FROM public.checkin_streaks WHERE user_id = _user_id;
  IF NOT FOUND THEN
    INSERT INTO public.checkin_streaks (user_id) VALUES (_user_id) RETURNING * INTO row;
  END IF;

  -- A missed day breaks the streak.
  IF row.last_checkin_date IS NOT NULL AND row.last_checkin_date < (current_date - 1) THEN
    current_streak := 0;
  ELSE
    current_streak := row.current_streak;
  END IF;

  longest_streak := row.longest_streak;
  last_checkin_date := row.last_checkin_date;
  total_rewards := row.total_rewards;
  checked_in_today := (row.last_checkin_date = current_date);
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_daily_checkin_for(_user_id uuid)
RETURNS TABLE(status text, current_streak integer, rewarded integer, balance integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  reward_credits constant integer := 10;
  row public.checkin_streaks;
  next_streak integer;
  granted integer := 0;
  new_balance integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  PERFORM public.ensure_credit_account(_user_id);

  SELECT * INTO row FROM public.checkin_streaks WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.checkin_streaks (user_id) VALUES (_user_id) RETURNING * INTO row;
  END IF;

  IF row.last_checkin_date = current_date THEN
    status := 'already_checked_in';
    current_streak := row.current_streak;
    rewarded := 0;
    SELECT balance INTO new_balance FROM public.credit_accounts WHERE user_id = _user_id;
    balance := coalesce(new_balance, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  IF row.last_checkin_date = current_date - 1 THEN
    next_streak := row.current_streak + 1;
  ELSE
    next_streak := 1;
  END IF;

  IF next_streak >= 7 THEN
    granted := reward_credits;
    next_streak := 0;
  END IF;

  UPDATE public.checkin_streaks
  SET current_streak = next_streak,
      longest_streak = greatest(longest_streak, CASE WHEN granted > 0 THEN 7 ELSE next_streak END),
      last_checkin_date = current_date,
      total_rewards = total_rewards + granted,
      updated_at = now()
  WHERE user_id = _user_id;

  IF granted > 0 THEN
    new_balance := public.grant_credits(_user_id, granted, 'daily_checkin_reward');
  ELSE
    SELECT balance INTO new_balance FROM public.credit_accounts WHERE user_id = _user_id;
  END IF;

  status := CASE WHEN granted > 0 THEN 'rewarded' ELSE 'checked_in' END;
  current_streak := CASE WHEN granted > 0 THEN 7 ELSE next_streak END;
  rewarded := granted;
  balance := coalesce(new_balance, 0);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_checkin_state_for(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_daily_checkin_for(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkin_state_for(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_daily_checkin_for(uuid) TO service_role;